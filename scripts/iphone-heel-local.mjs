// scripts/iphone-heel-local.mjs
// Local-only launcher: one private XDG file keeps the experiment usable from any terminal.
import { spawn, spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { homedir, networkInterfaces } from 'node:os';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configDirectory = resolve(
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
  'telltales'
);
const configFile = join(configDirectory, 'iphone-heel.json');
const stateFile = join(configDirectory, 'iphone-heel-processes.json');
const secretNames = Object.freeze(['ingress', 'producer', 'viewer']);

function credentials(value) {
  const result = value?.credentials;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return {};
  for (const name of secretNames)
    if (name in result && typeof result[name] !== 'string')
      throw Error(`local iPhone-heel configuration has an invalid ${name} credential`);
  return result;
}

async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw Error(`refusing unsafe local configuration directory: ${directory}`);
  if (info.mode & 0o077)
    throw Error(
      `local configuration directory must not be group- or world-accessible: ${directory}`
    );
}

async function privateFile(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
    throw Error(`refusing unsafe local configuration file: ${file}`);
  if (info.mode & 0o077)
    throw Error(`local configuration file must not be group- or world-accessible: ${file}`);
}

async function atomicWrite(file, value) {
  const directory = dirname(file);
  await privateDirectory(directory);
  const temporary = join(directory, `.${process.pid}-${randomInt(1_000_000)}.tmp`);
  let handle;
  try {
    handle = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600
    );
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, file);
    await chmod(file, 0o600);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export function validateConfig(value) {
  if (!value || value.version !== 2 || typeof value.host !== 'string' || !value.host)
    throw Error(
      'local iPhone-heel configuration is missing; run make iphone-heel-setup TELLTALES_SERVER_HOST=…'
    );
  for (const key of ['signalkIngress', 'signalkStream']) {
    try {
      const url = new URL(value[key]);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) throw Error();
    } catch {
      throw Error(`local iPhone-heel configuration has an invalid ${key}`);
    }
  }
  credentials(value);
  return Object.freeze(value);
}
export function signalKLoginUrl(config) {
  const ingress = new URL(config.signalkIngress);
  return `${ingress.protocol}//${ingress.host}/signalk/v1/auth/login`;
}
export async function renewSignalKCredential({
  config,
  role,
  username,
  password,
  request = fetch,
  save = saveSecret,
}) {
  if (!['producer', 'viewer'].includes(role))
    throw Error('only producer or viewer Signal K credentials can be renewed by login');
  if (!username || !password)
    throw Error('Signal K username and password are required; no credential changed');
  let response;
  try {
    response = await request(signalKLoginUrl(config), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw Error('could not reach the saved Signal K login endpoint; no credential changed');
  }
  if (!response.ok) throw Error('Signal K login was rejected; no credential changed');
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error('Signal K login returned no usable credential; no credential changed');
  }
  if (!body || typeof body.token !== 'string' || !body.token)
    throw Error('Signal K login returned no usable credential; no credential changed');
  await save(role, body.token);
}
export async function readConfig(file = configFile) {
  try {
    await privateFile(file);
    return validateConfig(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT')
      throw Error(
        'no local iPhone-heel configuration; run make iphone-heel-setup TELLTALES_SERVER_HOST=…'
      );
    throw error;
  }
}
export async function writeConfig({ host, signalkPort = 3000 }, file = configFile) {
  if (!host || /[/?#\s]/.test(host))
    throw Error('TELLTALES_SERVER_HOST must be a hostname or IP address');
  if (
    !Number.isInteger(Number(signalkPort)) ||
    Number(signalkPort) < 1 ||
    Number(signalkPort) > 65535
  )
    throw Error('SIGNALK_PORT must be a valid port');
  const existing = await readConfig(file).catch((error) => {
    if (error.message.startsWith('no local iPhone-heel configuration')) return null;
    throw error;
  });
  const value = {
    version: 2,
    host,
    signalkIngress: `http://127.0.0.1:${signalkPort}/plugins/telltales-observations/observations`,
    signalkStream: `ws://127.0.0.1:${signalkPort}/signalk/v1/stream?subscribe=none`,
    credentials: credentials(existing),
  };
  await atomicWrite(file, value);
  return Object.freeze(value);
}
export async function saveSecret(name, value, file = configFile) {
  if (!secretNames.includes(name) || !value) throw Error(`missing ${name} credential`);
  const config = await readConfig(file);
  await atomicWrite(file, {
    ...config,
    credentials: { ...credentials(config), [name]: value },
  });
}
export async function readSecret(name, file = configFile) {
  if (!secretNames.includes(name)) throw Error(`missing ${name} credential`);
  const value = credentials(await readConfig(file))[name];
  if (!value) throw Error(`missing ${name} credential`);
  return value;
}
export function credentialExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return Number.isFinite(payload.exp) ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}
export function suggestedLanHosts(interfaces = networkInterfaces()) {
  return Object.values(interfaces)
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}
export function setupDecision({ config, hosts, certificateReady, signalKStatus, webStatus }) {
  return Object.freeze({
    host: config?.host || hosts[0] || null,
    needsHost: !config?.host && hosts.length !== 1,
    certificateReady,
    signalKStatus,
    webStatus,
  });
}
const portOpen = (port, host = '127.0.0.1') =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
async function readState() {
  try {
    await privateFile(stateFile);
    return JSON.parse(await readFile(stateFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
async function saveState(value) {
  await atomicWrite(stateFile, value);
}
async function register(role, pid) {
  const state = await readState();
  state[role] = { pid, startedAt: new Date().toISOString() };
  await saveState(state);
}
async function unregister(role) {
  const state = await readState();
  delete state[role];
  await saveState(state);
}
async function savePairing(code) {
  const state = await readState();
  state.pairing = code;
  await saveState(state);
}
async function clearPairing() {
  const state = await readState();
  delete state.pairing;
  await saveState(state);
}
async function requiredSecret(name) {
  let value;
  try {
    value = await readSecret(name);
  } catch (error) {
    if (!/missing .* credential/.test(error.message)) throw error;
    const recovery = ['producer', 'viewer'].includes(name)
      ? `make iphone-heel-credentials-${name}`
      : 'make iphone-heel-credentials-ingress';
    throw Error(`missing or expired ${name} credential; run ${recovery}`);
  }
  const expiresAt = ['producer', 'viewer'].includes(name) && credentialExpiry(value);
  if (expiresAt && expiresAt <= new Date())
    throw Error(
      `${name} credential expired at ${expiresAt.toISOString()}; run make iphone-heel-credentials-${name}`
    );
  return value;
}
export const createPairingCode = (random = randomInt) => `${random(1_000_000)}`.padStart(6, '0');
export function serviceLaunchDecision({ occupied, owned }) {
  if (!occupied) return 'start';
  return owned ? 'reuse' : 'refuse';
}
export function coordinatedLaunchPlan({ producer, hud }) {
  if (!['start', 'reuse'].includes(producer) || !['start', 'reuse'].includes(hud))
    throw Error('both experiment ports must be available or owned before startup');
  return Object.freeze({ producer, hud });
}
export async function launchServices(plan, { runService, stopService }) {
  const started = [];
  try {
    for (const role of ['producer', 'hud']) {
      await runService(role, plan[role]);
      if (plan[role] === 'start') started.push(role);
    }
  } catch (error) {
    for (const role of started.reverse()) await stopService(role).catch(() => {});
    throw error;
  }
}
async function ownedProcess(role) {
  const state = await readState(),
    item = state[role];
  if (!item) return false;
  const command = spawnSync('ps', ['-p', `${item.pid}`, '-o', 'command='], {
    encoding: 'utf8',
  }).stdout;
  return command.includes(
    role === 'producer' ? 'experiments/iphone-heel/server.mjs' : 'scripts/server.mjs'
  );
}
function probeHttps(port) {
  return new Promise((resolve) => {
    const request = httpsGet(
      { host: '127.0.0.1', port, path: '/', rejectUnauthorized: false, timeout: 500 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      }
    );
    request.once('timeout', () => request.destroy());
    request.once('error', () => resolve(false));
  });
}
async function ready(role) {
  if (role === 'producer') return probeHttps(8443);
  try {
    return (await fetch('http://127.0.0.1:4173/', { signal: AbortSignal.timeout(500) })).ok;
  } catch {
    return false;
  }
}
async function inspectService(role) {
  const port = role === 'producer' ? 8443 : 4173;
  const decision = serviceLaunchDecision({
    occupied: await portOpen(port),
    owned: await ownedProcess(role),
  });
  if (decision === 'reuse' && !(await ready(role)))
    throw Error(
      `recorded experiment-owned ${role} process is not ready; run make iphone-heel-stop first`
    );
  if (decision === 'refuse')
    throw Error(
      role === 'producer'
        ? 'port 8443 is occupied by a non-experiment service; it was left untouched.'
        : 'port 4173 already has a web server; it is not experiment-owned, so it was left running.'
    );
  return decision;
}
function openHud() {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const browser = spawn(opener, ['http://127.0.0.1:4173/?view=hud&template=sailing-hud&mode=signalk'], {
    detached: true,
    stdio: 'ignore',
  });
  browser.once('error', () => {});
  browser.unref();
}
async function stopRole(role) {
  const state = await readState(),
    item = state[role];
  if (!item || !(await ownedProcess(role))) return false;
  process.kill(item.pid, 'SIGTERM');
  for (let tries = 0; tries < 20; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      process.kill(item.pid, 0);
    } catch {
      await unregister(role);
      return true;
    }
  }
  throw Error(`experiment-owned ${role} did not stop; it was left running`);
}
async function waitForReady(role) {
  for (let tries = 0; tries < 30; tries += 1) {
    if (await ready(role)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`${role} did not become ready`);
}
async function run(role, { background = false, decision } = {}) {
  const config = await readConfig(),
    env = { ...process.env, TELLTALES_SERVER_HOST: config.host };
  let command;
  if (role === 'producer') {
    const launch = decision ?? (await inspectService('producer'));
    if (launch === 'reuse') {
      return console.log('Reusing the existing experiment-owned phone producer.');
    }
    env.SIGNALK_TOKEN = await requiredSecret('producer');
    env.SIGNALK_INGRESS_TOKEN = await requiredSecret('ingress');
    env.SIGNALK_INGRESS = config.signalkIngress;
    const pairing = createPairingCode();
    await savePairing(pairing);
    env.IPHONE_HEEL_PAIRING_CODE = pairing;
    command = ['node', 'experiments/iphone-heel/server.mjs'];
  } else {
    const launch = decision ?? (await inspectService('hud'));
    if (launch === 'reuse') {
      console.log('Reusing the existing experiment-owned authenticated HUD server.');
      openHud();
      return;
    }
    env.TELLTALES_SIGNALK_STREAM = config.signalkStream;
    env.TELLTALES_SIGNALK_STREAM_TOKEN = await requiredSecret('viewer');
    command = ['node', 'scripts/server.mjs'];
  }
  const child = spawn(command[0], command.slice(1), {
      cwd: root,
      detached: background,
      env,
      stdio: background ? 'ignore' : 'inherit',
    }),
    clear = () => role === 'producer' && void clearPairing();
  await register(role, child.pid);
  if (background) child.unref();
  try {
    await waitForReady(role);
  } catch (error) {
    if (!child.killed) child.kill('SIGTERM');
    await unregister(role);
    clear();
    throw error;
  }
  if (role === 'hud') {
    openHud();
  }
  for (const signal of background ? [] : ['SIGINT', 'SIGTERM', 'SIGHUP'])
    process.on(signal, () => {
      child.kill(signal);
      clear();
    });
  child.on('exit', async (code, signal) => {
    clear();
    await unregister(role);
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
async function start() {
  const config = await readConfig();
  if (!(await portOpen(Number(new URL(config.signalkIngress).port || 80))))
    throw Error(
      'Signal K is not responding on its saved loopback endpoint; it was not started or changed.'
    );
  for (const name of ['producer', 'ingress', 'viewer']) await requiredSecret(name);
  const plan = coordinatedLaunchPlan({
    producer: await inspectService('producer'),
    hud: await inspectService('hud'),
  });
  await launchServices(plan, {
    runService: (role, decision) => run(role, { background: true, decision }),
    stopService: stopRole,
  });
  console.log(
    `Phone: https://${config.host}:8443/ — enter the current six-digit code from: make iphone-heel-pairing-code`
  );
  console.log('HUD opened at http://127.0.0.1:4173/?view=hud&template=sailing-hud&mode=signalk');
}
async function status() {
  const state = await readState(),
    config = await readConfig().catch(() => null);
  const signalkPort = config ? Number(new URL(config.signalkIngress).port || 80) : 3000;
  const report = {
    configured: Boolean(config),
    signalK: await portOpen(signalkPort),
    web: await portOpen(4173),
    processes: {},
  };
  for (const role of ['producer', 'hud']) {
    const item = state[role];
    if (!item) continue;
    try {
      process.kill(item.pid, 0);
      report.processes[role] = 'running';
    } catch {
      report.processes[role] = 'not running';
    }
  }
  console.log(JSON.stringify(report, null, 2));
}
async function stop() {
  const state = await readState();
  for (const role of ['producer', 'hud']) {
    const item = state[role];
    if (!item) continue;
    const command = spawnSync('ps', ['-p', `${item.pid}`, '-o', 'command='], {
      encoding: 'utf8',
    }).stdout;
    const expected =
      role === 'producer' ? 'experiments/iphone-heel/server.mjs' : 'scripts/server.mjs';
    if (!command.includes(expected)) {
      console.log(`No matching experiment-owned ${role} process; left PID ${item.pid} untouched.`);
      continue;
    }
    if (await stopRole(role)) console.log(`Stopped experiment-owned ${role} process.`);
  }
}
async function main() {
  const [command, ...arguments_] = process.argv.slice(2);
  if (command === 'setup') {
    const existing = await readConfig().catch(() => null),
      hosts = suggestedLanHosts(),
      host = arguments_[0] || existing?.host || (hosts.length === 1 ? hosts[0] : null);
    const decision = setupDecision({
      config: existing,
      hosts,
      certificateReady: false,
      signalKStatus: await portOpen(Number(process.env.SIGNALK_PORT || 3000)),
      webStatus: await portOpen(4173),
    });
    if (!host)
      throw Error(
        `choose a LAN address and run make iphone-heel-setup TELLTALES_SERVER_HOST=<address>; detected: ${hosts.join(', ') || 'none'}`
      );
    const config = await writeConfig({
      host,
      signalkPort: Number(process.env.SIGNALK_PORT || 3000),
    });
    console.log(
      `Setup: LAN host ${config.host} ${existing ? 'reused' : 'saved'}; Signal K ${decision.signalKStatus ? 'is responding' : 'is not responding'}; web port 4173 ${decision.webStatus ? 'is occupied (will not be stopped)' : 'is free'}.`
    );
    console.log(
      'TLS is checked by make before this wizard. Run make iphone-heel-credentials only if credentials are missing, revoked, or expired.'
    );
  } else if (command === 'save-secret') {
    const value = await new Promise((resolve) => {
      let text = '';
      process.stdin
        .setEncoding('utf8')
        .on('data', (part) => (text += part))
        .on('end', () => resolve(text.trim()));
    });
    await saveSecret(arguments_[0], value);
  } else if (command === 'renew-token') {
    const [username = '', ...password] = await new Promise((resolve) => {
      let text = '';
      process.stdin
        .setEncoding('utf8')
        .on('data', (part) => (text += part))
        .on('end', () => resolve(text.split(/\r?\n/)));
    });
    await renewSignalKCredential({
      config: await readConfig(),
      role: arguments_[0],
      username,
      password: password.join('\n').replace(/\n$/, ''),
    });
    console.log(`Renewed ${arguments_[0]} Signal K credential in private local configuration.`);
  } else if (command === 'pairing-code') {
    const pairing = (await readState()).pairing;
    if (!pairing) throw Error('no active pairing code; start the phone producer first');
    console.log(pairing);
  } else if (command === 'host') console.log((await readConfig()).host);
  else if (command === 'producer' || command === 'hud') await run(command);
  else if (command === 'start') await start();
  else if (command === 'status') await status();
  else if (command === 'stop') await stop();
  else
    throw Error(
      'usage: iphone-heel-local.mjs setup|save-secret|renew-token|pairing-code|producer|hud|start|status|stop'
    );
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(`iPhone heel: ${error.message}`);
    process.exitCode = 2;
  });
