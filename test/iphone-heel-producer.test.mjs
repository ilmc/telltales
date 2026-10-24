// test/iphone-heel-producer.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import WebSocket from 'ws';
import { createPairing } from '../experiments/iphone-heel/auth.mjs';
import {
  createIphoneHeelProducer,
  createIphoneHeelPublicationQueue,
  createPairingAttemptLimiter,
} from '../experiments/iphone-heel/server.mjs';

const exec = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const httpsRequest = (url, { method = 'GET', headers, body } = {}) =>
  new Promise((resolve, reject) => {
    const req = request(url, { method, headers, rejectUnauthorized: false }, (res) => {
      let text = '';
      res.on('data', (part) => (text += part));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
const openSocket = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { rejectUnauthorized: false, headers });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
const onceClose = (ws) => new Promise((resolve) => ws.once('close', resolve));
const refusedSocket = (url) =>
  new Promise((resolve) => {
    const ws = new WebSocket(url, { rejectUnauthorized: false });
    ws.once('error', resolve);
    ws.once('close', resolve);
  });

test('paired HTTPS/WSS producer retains lifecycle, source time, and ordered invalidation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'telltales-iphone-producer-'));
  await exec('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-keyout',
    join(directory, 'key.pem'),
    '-out',
    join(directory, 'cert.pem'),
  ]);
  const pairing = await createPairing({
    file: join(directory, 'devices.json'),
    code: '764201',
  });
  const published = [];
  const producer = createIphoneHeelProducer({
    tls: {
      key: await readFile(join(directory, 'key.pem')),
      cert: await readFile(join(directory, 'cert.pem')),
    },
    pairing,
    heartbeatMs: 30,
    staleMs: 90,
    publishIngress: async (observation) => published.push(observation),
  });
  await new Promise((resolve) => producer.server.listen(0, '127.0.0.1', resolve));
  const base = `https://127.0.0.1:${producer.server.address().port}`;
  try {
    assert.equal((await httpsRequest(`${base}/`, { headers: {} })).status, 200);
    await refusedSocket(base.replace('https:', 'wss:') + '/stream');
    const paired = await httpsRequest(`${base}/auth/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"code":"764201"}',
    });
    assert.equal(paired.status, 201);
    assert.equal(
      (
        await httpsRequest(`${base}/auth/pair`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"code":"764201"}',
        })
      ).status,
      409,
      'one launch accepts only one phone pairing'
    );
    const cookie = paired.headers['set-cookie'][0].split(';', 1)[0];
    const ws = await openSocket(base.replace('https:', 'wss:') + '/stream', { cookie });
    ws.send(JSON.stringify({ type: 'hello', role: 'phone' }));
    const observedAt = new Date().toISOString();
    const reading = {
      type: 'heel',
      value: 12,
      valid: true,
      observedAt,
      method: 'devicemotion gravity',
      calibration: 'manual-zero',
    };
    ws.send(JSON.stringify(reading));
    await sleep(50);
    assert.equal(published[0].observedAt, observedAt);
    assert.equal(published[0].provenance.serverReceivedAt === observedAt, false);
    assert.equal(published[0].provenance.method, 'devicemotion gravity');
    await sleep(40);
    ws.send(JSON.stringify({ ...reading, observedAt: new Date().toISOString() }));
    await sleep(50);
    assert.ok(
      published.filter((item) => item.valid).length >= 2,
      'steady reading refreshes HUD freshness'
    );
    ws.send(
      JSON.stringify({
        type: 'heel',
        value: null,
        valid: false,
        reason: 'sensor invalid',
        observedAt: new Date().toISOString(),
        method: 'devicemotion gravity',
        calibration: 'manual-zero',
      })
    );
    await sleep(40);
    assert.equal(published.at(-1).valid, false);
    ws.close();
    await onceClose(ws);
    await sleep(40);
    assert.match(published.at(-1).reason, /disconnected/);
    const reconnected = await openSocket(base.replace('https:', 'wss:') + '/stream', { cookie });
    reconnected.send(JSON.stringify({ type: 'hello', role: 'phone' }));
    reconnected.send(
      JSON.stringify({ ...reading, value: -9, observedAt: new Date().toISOString() })
    );
    await sleep(40);
    assert.equal(published.at(-1).value, -9);
    await sleep(150);
    assert.match(published.at(-1).reason, /stale/);
    reconnected.close();
  } finally {
    await producer.close();
  }
});

test('pairing limits failures across source addresses for one short-lived session', () => {
  let now = 1000;
  const limiter = createPairingAttemptLimiter({ clock: () => now, limit: 2, windowMs: 100 });
  assert.ok(limiter.allows('192.0.2.1'));
  limiter.failed('192.0.2.1');
  assert.ok(limiter.allows('192.0.2.2'));
  limiter.failed('192.0.2.2');
  assert.equal(limiter.allows('192.0.2.3'), false, 'changing addresses cannot extend the session');
  now += 101;
  assert.ok(limiter.allows('192.0.2.3'), 'the short pairing window has a bounded reset');
});

test('a recovered reading supersedes a failed invalidation, while unresolved invalidation retries', async () => {
  const published = [];
  let rejectNextInvalidation = true;
  const publication = createIphoneHeelPublicationQueue({
    publishIngress: async (observation) => {
      if (!observation.valid && rejectNextInvalidation) {
        rejectNextInvalidation = false;
        throw Error('controlled ingress failure');
      }
      published.push(observation);
    },
  });
  const reading = (value) => ({
    type: 'heel',
    value,
    valid: true,
    observedAt: new Date().toISOString(),
    method: 'devicemotion gravity',
    calibration: 'manual-zero',
  });
  await publication.publish(reading(12));
  await assert.rejects(publication.invalidate('iPhone disconnected or backgrounded'));
  await publication.publish(reading(-9));
  await publication.retryPending();
  assert.deepEqual(
    published.map((item) => item.value),
    [12, -9],
    'a watchdog retry cannot republish the obsolete unavailable state after recovery'
  );

  rejectNextInvalidation = true;
  await assert.rejects(publication.invalidate('iPhone reading stale or backgrounded'));
  await publication.retryPending();
  assert.match(published.at(-1).reason, /stale/);
  assert.equal(
    published.filter((item) => /stale/.test(item.reason || '')).length,
    1,
    'the unresolved invalidation retries once in serialized order'
  );
});
