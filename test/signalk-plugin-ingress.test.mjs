import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const createPlugin = createRequire(import.meta.url)('../signalk-plugin-telltales/index.js');
const observation = {
  id: 'vessel.heel',
  unit: 'deg',
  value: -12,
  observedAt: '2026-10-23T12:00:00.000Z',
  sourceId: 'test-phone',
  valid: true,
  simulated: false,
};
function setup() {
  let handler, permission, options, delta;
  const app = {
      handleMessage: (_id, value) => {
        delta = value;
      },
      debug: () => {},
    },
    plugin = createPlugin(app);
  plugin.registerWithRouter({
    access: (level) => ({
      post: (path, fn) => {
        permission = { level, path };
        handler = fn;
      },
    }),
    options: (path, fn) => {
      options = { path, fn };
    },
  });
  plugin.start({ token: 'local-ingress-token' });
  const request = (authorization, ingressToken) => ({
    get: (name) => ({ authorization, 'x-telltales-ingress-token': ingressToken })[name],
    body: observation,
  });
  const response = () => {
    const state = { headers: {} };
    const res = {
      set: (name, value) => {
        state.headers[name] = value;
        return res;
      },
      status: (code) => {
        state.status = code;
        return res;
      },
      json: (body) => {
        state.body = body;
        return res;
      },
      sendStatus: (code) => {
        state.status = code;
        return res;
      },
      state,
    };
    return res;
  };
  return { handler, permission, options, request, response, delta: () => delta };
}
test('Signal K readwrite authorization and the plugin ingress token are separate', () => {
  const fixture = setup();
  assert.deepEqual(fixture.permission, { level: 'readwrite', path: '/observations' });
  const denied = fixture.response();
  fixture.handler(fixture.request('Bearer signalk-readwrite-jwt', 'wrong-token'), denied);
  assert.equal(denied.state.status, 401);
  const accepted = fixture.response();
  fixture.handler(
    fixture.request('Bearer signalk-readwrite-jwt', 'Bearer local-ingress-token'),
    accepted
  );
  assert.equal(accepted.state.status, 202);
  assert.equal(fixture.delta().updates[0].values[0].path, 'navigation.attitude.roll');
  assert.equal(fixture.delta().updates[0].values[0].value, -Math.PI / 15);
});
test('CORS preflight permits only the browser headers needed by the protected POST', () => {
  const fixture = setup(),
    response = fixture.response();
  fixture.options.fn({}, response);
  assert.equal(fixture.options.path, '/observations');
  assert.equal(response.state.status, 204);
  assert.equal(response.state.headers['Access-Control-Allow-Origin'], 'http://localhost:4173');
  assert.equal(
    response.state.headers['Access-Control-Allow-Headers'],
    'Authorization, Content-Type, X-Telltales-Ingress-Token'
  );
  assert.equal(response.state.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
});
