import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createStaticServer} from '../scripts/server.mjs';

async function withServer(run) {
  const root = await mkdtemp(join(tmpdir(), 'telltales-server-'));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Telltales</title>');
  await writeFile(join(root, 'module.mjs'), 'export const value = 42;');
  const server = createStaticServer({root});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const {port} = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('development server serves the app root and ES modules', async () => {
  await withServer(async baseURL => {
    const root = await fetch(`${baseURL}/?view=hud&template=sailing-hud`);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /Telltales/);
    assert.match(root.headers.get('content-type'), /^text\/html/);

    const module = await fetch(`${baseURL}/module.mjs`);
    assert.equal(module.status, 200);
    assert.match(module.headers.get('content-type'), /^text\/javascript/);
  });
});

test('development server handles HEAD, missing files, and unsupported methods', async () => {
  await withServer(async baseURL => {
    const head = await fetch(`${baseURL}/`, {method: 'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    assert.equal((await fetch(`${baseURL}/missing`)).status, 404);
    assert.equal((await fetch(`${baseURL}/`, {method: 'POST'})).status, 405);
  });
});
