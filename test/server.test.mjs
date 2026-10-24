// test/server.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import WebSocket, { WebSocketServer } from 'ws';
import { attachSignalKStreamProxy, createStaticServer } from '../scripts/server.mjs';

async function withServer(run) {
  const root = await mkdtemp(join(tmpdir(), 'telltales-server-'));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Telltales</title>');
  await writeFile(join(root, 'module.mjs'), 'export const value = 42;');
  const server = createStaticServer({ root });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('development server serves the app root and ES modules', async () => {
  await withServer(async (baseURL) => {
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
  await withServer(async (baseURL) => {
    const head = await fetch(`${baseURL}/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    assert.equal((await fetch(`${baseURL}/missing`)).status, 404);
    assert.equal((await fetch(`${baseURL}/`, { method: 'POST' })).status, 405);
  });
});

test('local Signal K proxy rejects cross-origin WebSocket upgrades before contacting Signal K', async () => {
  const root = await mkdtemp(join(tmpdir(), 'telltales-proxy-'));
  await writeFile(join(root, 'index.html'), '<!doctype html>');
  const server = createStaticServer({ root });
  attachSignalKStreamProxy(server, { stream: 'ws://127.0.0.1:1/stream', token: 'never-exposed' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/local/signalk-stream`, {
        origin: 'https://untrusted.example',
      });
      socket.once('error', resolve);
      socket.once('close', resolve);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('local Signal K proxy forwards a subscription sent before the upstream opens', async () => {
  let subscription;
  const upstream = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => upstream.once('listening', resolve));
  upstream.on('connection', (socket, request) => {
    assert.equal(
      new URL(request.url, 'ws://localhost').searchParams.get('token'),
      'private-viewer'
    );
    socket.once('message', (message) => {
      subscription = JSON.parse(message);
      socket.send(JSON.stringify({ roll: -18 }));
    });
  });
  const root = await mkdtemp(join(tmpdir(), 'telltales-proxy-'));
  await writeFile(join(root, 'index.html'), '<!doctype html>');
  const server = createStaticServer({ root });
  attachSignalKStreamProxy(server, {
    stream: `ws://127.0.0.1:${upstream.address().port}/signalk/v1/stream?subscribe=none`,
    token: 'private-viewer',
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/local/signalk-stream`, {
        origin: `http://127.0.0.1:${server.address().port}`,
      });
      socket.once('open', () =>
        socket.send(JSON.stringify({ subscribe: [{ path: 'navigation.attitude.roll' }] }))
      );
      socket.once('message', (message) => {
        assert.deepEqual(subscription, { subscribe: [{ path: 'navigation.attitude.roll' }] });
        assert.deepEqual(JSON.parse(message), { roll: -18 });
        socket.close();
        resolve();
      });
      socket.once('error', reject);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => upstream.close(resolve));
  }
});
