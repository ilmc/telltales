import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '@playwright/test';

const root = new URL('..', import.meta.url).pathname;
const compose = new URL('../docker-compose.signalk.yml', import.meta.url).pathname;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const command = (file, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(file, args, {cwd: root, ...options}), output = [];
  child.stdout?.on('data', data => output.push(data)); child.stderr?.on('data', data => output.push(data));
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(Buffer.concat(output).toString()) : reject(Error(`${file} ${args.join(' ')} exited ${code}\n${Buffer.concat(output)}`)));
});
async function freePort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const {port} = server.address(); await new Promise(resolve => server.close(resolve)); return port; }
async function waitFor(url) { let last; for (let i = 0; i < 60; i++) { try { const response = await fetch(url); if ([200, 401].includes(response.status)) return; last = `HTTP ${response.status}`; } catch (error) { last = error.message; } await sleep(500); } throw Error(`Signal K did not become ready: ${last}`); }
async function request(url, {token, method = 'POST', body, headers = {}} = {}) { const response = await fetch(url, {method, headers: {'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {}), ...headers}, body: body === undefined ? undefined : JSON.stringify(body)}); return {status: response.status, text: await response.text()}; }
async function login(base, username, password) { const response = await request(`${base}/signalk/v1/auth/login`, {body: {username, password}}); assert.equal(response.status, 200, `login for ${username}: ${response.text}`); return JSON.parse(response.text).token; }
function observation(value, extra = {}) { return {id: 'vessel.heel', unit: 'deg', value, observedAt: new Date().toISOString(), sourceId: 'e2e-synthetic-heel', valid: true, simulated: true, ...extra}; }

const port = await freePort(), appPort = await freePort(), project = `telltales-e2e-${process.pid}-${Date.now()}`, base = `http://127.0.0.1:${port}`;
let app, browser, adminToken, readwriteToken, testError;
try {
  await command('docker', ['compose', '-p', project, '-f', compose, 'up', '-d'], {env: {...process.env, SIGNALK_PORT: String(port)}});
  await waitFor(`${base}/signalk/v1/api/vessels/self`);
  let response = await request(`${base}/skServer/enableSecurity`, {body: {userId: 'e2e-admin', password: 'e2e-admin-password'}});
  assert.equal(response.status, 200, response.text);
  adminToken = await login(base, 'e2e-admin', 'e2e-admin-password');
  for (const [username, type, password] of [['e2e-readwrite', 'readwrite', 'e2e-readwrite-password'], ['e2e-readonly', 'readonly', 'e2e-readonly-password']]) {
    response = await request(`${base}/skServer/security/users/${username}`, {token: adminToken, body: {type, password}});
    assert.equal(response.status, 200, `create ${type}: ${response.text}`);
  }
  readwriteToken = await login(base, 'e2e-readwrite', 'e2e-readwrite-password');
  const readonlyToken = await login(base, 'e2e-readonly', 'e2e-readonly-password');
  const ingressToken = `e2e-ingress-${process.pid}-${Date.now()}`;
  response = await request(`${base}/plugins/telltales-observations/config`, {token: adminToken, body: {enabled: true, configuration: {token: ingressToken}}});
  assert.equal(response.status, 200, `configure plugin: ${response.text}`);
  const ingress = `${base}/plugins/telltales-observations/observations`;
  const publish = (token, pluginToken, payload) => request(ingress, {token, body: payload, headers: pluginToken === undefined ? {} : {'x-telltales-ingress-token': `Bearer ${pluginToken}`}});
  response = await publish(readonlyToken, ingressToken, observation(-18)); assert.notEqual(response.status, 202, `readonly unexpectedly accepted: ${response.text}`);
  response = await publish('not-a-signalk-credential', ingressToken, observation(-18)); assert.notEqual(response.status, 202, `invalid credential unexpectedly accepted: ${response.text}`);
  response = await publish(readwriteToken, 'wrong-ingress-token', observation(-18)); assert.notEqual(response.status, 202, `wrong ingress token unexpectedly accepted: ${response.text}`);
  response = await publish(readwriteToken, undefined, observation(-18)); assert.notEqual(response.status, 202, `missing ingress token unexpectedly accepted: ${response.text}`);

  app = spawn('node', ['scripts/server.mjs'], {cwd: root, env: {...process.env, HOST: '127.0.0.1', PORT: String(appPort)}});
  await waitFor(`http://127.0.0.1:${appPort}/`);
  browser = await chromium.launch({headless: true});
  const context = await browser.newContext(), hud = await context.newPage(), simulator = await context.newPage(), frames = [];
  hud.on('websocket', socket => socket.on('framereceived', event => frames.push(event.payload)));
  const query = new URLSearchParams({mode: 'signalk', template: 'sailing-hud-full', signalkEndpoint: ingress, signalkToken: readwriteToken, signalkIngressToken: ingressToken, signalkStream: `${base.replace('http', 'ws')}/signalk/v1/stream?subscribe=none`});
  await hud.goto(`http://127.0.0.1:${appPort}/?view=hud&${query}`);
  response = await publish(readwriteToken, ingressToken, observation(-18)); assert.equal(response.status, 202, `readwrite publish: ${response.text}`);
  await hud.locator('.heel-value').waitFor({state: 'visible'});
  try { await hud.locator('.heel-value').filter({hasText: '-18'}).waitFor({timeout: 10000}); } catch (error) { throw Error(`${error.message}\nHUD status: ${await hud.locator('.hud-heel .status').textContent()}\nWebSocket frames: ${frames.join('\n')}`); }
  await hud.locator('.heel-direction').filter({hasText: 'PORT'}).waitFor({timeout: 10000});
  await hud.locator('.hud-heel .status').filter({hasText: 'LIVE · HEEL'}).waitFor({timeout: 10000});

  await simulator.goto(`http://127.0.0.1:${appPort}/?view=simulator&${query}`);
  await simulator.locator('#control-heel input[type=range]').evaluate(element => { element.value = '12'; element.dispatchEvent(new Event('input', {bubbles: true})); });
  await hud.locator('.heel-value').filter({hasText: '12'}).waitFor({timeout: 10000});
  await hud.locator('.heel-direction').filter({hasText: 'STARBOARD'}).waitFor({timeout: 10000});

  await simulator.close();
  response = await publish(readwriteToken, ingressToken, observation(null, {valid: false, reason: 'Explicit integration invalidation'})); assert.equal(response.status, 202, response.text);
  await hud.locator('.hud-heel .status').filter({hasText: 'UNAVAILABLE'}).waitFor({timeout: 10000});
  response = await publish(readwriteToken, ingressToken, observation(9)); assert.equal(response.status, 202, response.text);
  await hud.locator('.hud-heel .status').filter({hasText: 'LIVE · HEEL'}).waitFor({timeout: 10000});
  await hud.locator('.hud-heel .status').filter({hasText: 'UNAVAILABLE · Stale or future observation'}).waitFor({timeout: 36_000});

  await hud.evaluate(async ({url, token}) => await new Promise((resolve, reject) => { const socket = new WebSocket(`${url}/signalk/v1/stream?subscribe=none&token=${encodeURIComponent(token)}`); socket.onopen = () => { socket.send(JSON.stringify({context: 'vessels.urn:mrn:signalk:uuid:foreign', updates: [{timestamp: new Date().toISOString(), values: [{path: 'navigation.attitude.roll', value: 0.7}]}]})); setTimeout(() => { socket.close(); resolve(); }, 300); }; socket.onerror = () => reject(Error('foreign-vessel websocket failed')); }), {url: base.replace('http', 'ws'), token: readwriteToken});
  await sleep(500); assert.match(await hud.locator('.hud-heel .status').textContent(), /UNAVAILABLE/, 'foreign vessel changed self HUD');
  console.log('Signal K E2E passed: readwrite 202, negative authorization/token cases rejected, signed heel HUD, invalidation, stale data, and foreign-vessel isolation.');
} catch (error) {
  testError = error;
} finally {
  const cleanupErrors = [];
  if (browser) {
    try { await browser.close(); } catch (error) { cleanupErrors.push(error); }
  }
  if (app && !app.killed) {
    try { app.kill('SIGTERM'); } catch (error) { cleanupErrors.push(error); }
  }
  if (adminToken) for (const username of ['e2e-readwrite', 'e2e-readonly']) {
    try {
      const removal = await request(`${base}/skServer/security/users/${username}`, {token: adminToken, method: 'DELETE'});
      if (![200, 204, 404].includes(removal.status)) throw Error(`remove ${username}: HTTP ${removal.status} ${removal.text}`);
    } catch (error) { cleanupErrors.push(error); }
  }
  try {
    await command('docker', ['compose', '-p', project, '-f', compose, 'down', '--volumes', '--remove-orphans']);
  } catch (error) { cleanupErrors.push(error); }
  if (testError || cleanupErrors.length) {
    throw new AggregateError([...(testError ? [testError] : []), ...cleanupErrors], 'Signal K end-to-end run or cleanup failed');
  }
}
