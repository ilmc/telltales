// test/iphone-heel-auth.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createPairing, parseCookies } from '../experiments/iphone-heel/auth.mjs';

test('iPhone pairing stores a verifiable credential without accepting a wrong code', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'telltales-iphone-heel-')), 'devices.json');
  const pairing = await createPairing({ file, code: 'eight-or-more' });
  assert.equal(await pairing.pair('wrong-code'), null);
  const credential = await pairing.pair('eight-or-more');
  assert.match(credential, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(await pairing.authenticate(credential));
  assert.equal(await pairing.authenticate(`${credential}broken`), null);
  assert.equal(parseCookies('one=1; two=2').two, '2');
});
