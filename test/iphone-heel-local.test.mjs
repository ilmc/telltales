// test/iphone-heel-local.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createPairingCode,
  serviceLaunchDecision,
  readConfig,
  setupDecision,
  validateConfig,
  writeConfig,
} from '../scripts/iphone-heel-local.mjs';

test('local iPhone settings persist only non-secret host and endpoints with private permissions', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'telltales-local-settings-')), 'iphone-heel.json');
  const saved = await writeConfig({ host: '10.25.1.25', signalkPort: 3010 }, file);
  assert.equal(saved.host, '10.25.1.25');
  assert.match(saved.signalkIngress, /127\.0\.0\.1:3010/);
  assert.deepEqual(await readConfig(file), saved);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.doesNotMatch(JSON.stringify(saved), /token|secret|credential/i);
});

test('local iPhone settings reject absent host and invalid endpoints before launch', () => {
  assert.throws(
    () =>
      validateConfig({
        version: 1,
        host: '',
        signalkIngress: 'http://127.0.0.1:3000',
        signalkStream: 'ws://127.0.0.1:3000',
      }),
    /missing/
  );
  assert.throws(
    () =>
      validateConfig({
        version: 1,
        host: '10.25.1.25',
        signalkIngress: 'not a URL',
        signalkStream: 'ws://127.0.0.1:3000',
      }),
    /invalid/
  );
});

test('setup reuses a known host and asks only when discovery is ambiguous', () => {
  assert.equal(
    setupDecision({
      config: { host: '10.25.1.25' },
      hosts: ['10.25.1.25'],
      certificateReady: true,
      signalKStatus: true,
      webStatus: false,
    }).needsHost,
    false
  );
  const ambiguous = setupDecision({
    config: null,
    hosts: ['10.0.0.2', '192.168.1.2'],
    certificateReady: false,
    signalKStatus: false,
    webStatus: true,
  });
  assert.equal(ambiguous.needsHost, true);
  assert.equal(ambiguous.webStatus, true, 'occupied web port is reported, not stopped');
});

test('pairing code uses an injected cryptographic integer source and retains six digits', () => {
  assert.equal(
    createPairingCode(() => 42),
    '000042'
  );
  assert.equal(
    createPairingCode(() => 999999),
    '999999'
  );
});

test('service lifecycle reuses only a recorded experiment server and refuses unknown owners', () => {
  assert.equal(serviceLaunchDecision({ occupied: false, owned: false }), 'start');
  assert.equal(serviceLaunchDecision({ occupied: true, owned: true }), 'reuse');
  assert.equal(serviceLaunchDecision({ occupied: true, owned: false }), 'refuse');
});
