// test/iphone-heel-auth.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createPairing, parseCookies } from '../experiments/iphone-heel/auth.mjs';

test('iPhone pairing stores an expiring credential without accepting a wrong code', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'telltales-iphone-heel-')), 'devices.json');
  let now = 1000;
  const pairing = await createPairing({
    file,
    code: 'a-random-temporary-code',
    now: () => now,
    credentialLifetimeMs: 10,
  });
  assert.equal(await pairing.pair('wrong-code'), null);
  const credential = await pairing.pair('a-random-temporary-code');
  assert.match(credential, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(await pairing.authenticate(credential));
  assert.equal(await pairing.authenticate(`${credential}broken`), null);
  now += 11;
  assert.equal(await pairing.authenticate(credential), null);
  assert.equal(parseCookies('one=1; two=2').two, '2');
});

test('iPhone pairing requires a strong temporary secret', async () => {
  await assert.rejects(
    createPairing({ file: join(tmpdir(), 'unreachable-pairing.json'), code: 'too-short' }),
    /random 16/
  );
});
