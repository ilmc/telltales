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
import { createIphoneHeelProducer } from '../experiments/iphone-heel/server.mjs';

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
    code: 'strong-temporary-pairing-code',
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
      body: '{"code":"strong-temporary-pairing-code"}',
    });
    assert.equal(paired.status, 201);
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
    for (let attempt = 0; attempt < 5; attempt++)
      assert.equal(
        (
          await httpsRequest(`${base}/auth/pair`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{"code":"wrong"}',
          })
        ).status,
        401
      );
    assert.equal(
      (
        await httpsRequest(`${base}/auth/pair`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"code":"wrong"}',
        })
      ).status,
      429
    );
  } finally {
    await producer.close();
  }
});
