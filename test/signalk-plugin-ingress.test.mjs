import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const createPlugin = require('../signalk-plugin-telltales/index.js');

const observation = { id: 'vessel.heel', unit: 'deg', value: -12, observedAt: '2026-10-23T12:00:00.000Z', sourceId: 'test-phone', valid: true, simulated: false };
function setup() {
  let handler, permission, delta;
  const app = { handleMessage: (_id, value) => { delta = value; }, debug: () => {} };
  const plugin = createPlugin(app);
  plugin.registerWithRouter({ access: level => ({ post: (path, fn) => { permission = { level, path }; handler = fn; } }), options: () => {} });
  plugin.start({ token: 'local-token' });
  const request = authorization => ({ get: name => name === 'authorization' ? authorization : undefined, body: observation });
  const response = () => { const state = {}; const res = { set: () => res, status: code => { state.status = code; return res; }, json: body => { state.body = body; return res; }, state }; return res; };
  return { handler, permission, request, response, delta: () => delta };
}

test('Signal K ingress declares readwrite access and retains its local bearer check', () => {
  const fixture = setup();
  assert.deepEqual(fixture.permission, { level: 'readwrite', path: '/observations' });
  const denied = fixture.response();
  fixture.handler(fixture.request('Bearer wrong-token'), denied);
  assert.equal(denied.state.status, 401);
  const accepted = fixture.response();
  fixture.handler(fixture.request('Bearer local-token'), accepted);
  assert.equal(accepted.state.status, 202);
  assert.equal(fixture.delta().updates[0].values[0].path, 'navigation.attitude.roll');
  assert.equal(fixture.delta().updates[0].values[0].value, -Math.PI / 15);
});
