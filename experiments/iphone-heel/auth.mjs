// experiments/iphone-heel/auth.mjs
import { randomBytes, scrypt as callback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
const scrypt = promisify(callback);
const equal = (a, b) => {
  a = Buffer.from(a);
  b = Buffer.from(b);
  return a.length === b.length && timingSafeEqual(a, b);
};
const digest = async (secret, salt = randomBytes(16).toString('base64url')) => ({
  salt,
  hash: Buffer.from(await scrypt(secret, salt, 32)).toString('base64url'),
});
export const parseCookies = (header = '') =>
  Object.fromEntries(header.split(';').map((part) => part.trim().split(/=(.*)/s, 2)));
export async function createPairing({
  file,
  code,
  now = () => Date.now(),
  codeLifetimeMs = 5 * 60_000,
  credentialLifetimeMs = 12 * 60 * 60_000,
  reset = true,
}) {
  if (!/^\d{6}$/.test(code || ''))
    throw Error('IPHONE_HEEL_PAIRING_CODE must be a random six-digit numeric code');
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  let devices = {};
  const load = async () => {
    try {
      devices = JSON.parse(await readFile(file, 'utf8')).devices || {};
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  };
  const save = async () => {
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify({ version: 1, devices }), { mode: 0o600 });
    await rename(temp, file);
  };
  // A launcher restart deliberately revokes every browser cookie. The short code
  // is only an in-person, short-lived ceremony; the issued device credential has
  // independent high entropy.
  if (reset) {
    devices = {};
    await save();
  } else await load();
  const expiresAt = now() + codeLifetimeMs;
  return Object.freeze({
    async pair(candidate, at = now()) {
      if (at > expiresAt || !equal(String(candidate || ''), code)) return null;
      const id = randomBytes(12).toString('base64url'),
        secret = randomBytes(32).toString('base64url');
      devices[id] = {
        ...(await digest(secret)),
        pairedAt: new Date(at).toISOString(),
        expiresAt: new Date(at + credentialLifetimeMs).toISOString(),
      };
      await save();
      return `${id}.${secret}`;
    },
    async authenticate(cookie, at = now()) {
      await load();
      const [id, secret] = String(cookie || '').split('.', 2),
        device = devices[id];
      if (!device || Date.parse(device.expiresAt) <= at) return null;
      return equal((await digest(secret, device.salt)).hash, device.hash) ? id : null;
    },
    get expiresAt() {
      return expiresAt;
    },
  });
}
