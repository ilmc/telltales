// test/local-server-certificate.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
const helper = join(process.cwd(), 'scripts/prepare-local-server-certificate.sh');
const prepare = (host, directory) => exec('sh', [helper, host, directory]);
const refuses = async (host, directory) =>
  assert.rejects(prepare(host, directory), (error) => /does not match/.test(error.stderr));

test('local server certificate reuse compares complete IP and DNS SAN entries', async () => {
  const ipDirectory = await mkdtemp(join(tmpdir(), 'telltales-cert-ip-'));
  await prepare('192.0.2.100', ipDirectory);
  assert.match((await prepare('192.0.2.100', ipDirectory)).stdout, /Reusing valid/);
  await refuses('192.0.2.10', ipDirectory);

  const dnsDirectory = await mkdtemp(join(tmpdir(), 'telltales-cert-dns-'));
  await prepare('boat.local.evil', dnsDirectory);
  assert.match((await prepare('boat.local.evil', dnsDirectory)).stdout, /Reusing valid/);
  await refuses('boat.local', dnsDirectory);
});
