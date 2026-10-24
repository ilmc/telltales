// scripts/iphone-heel-local.mjs
// Local-only launcher: ignored configuration is separate from macOS Keychain secrets.
import { spawn, spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import net from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const local = resolve(root, '.local');
const configFile = resolve(local, 'iphone-heel.json');
const stateFile = resolve(local, 'iphone-heel-processes.json');
const service = 'io.github.ilmc.telltales.iphone-heel';
const accounts = Object.freeze({
  ingress: 'signalk-ingress-token',
  producer: 'signalk-readwrite-token',
  viewer: 'signalk-readonly-token',
  pairing: 'current-pairing-code',
});
const keychainSaveProgram = `
import Foundation
import Security
let service = CommandLine.arguments[1]
let account = CommandLine.arguments[2]
let value = FileHandle.standardInput.readDataToEndOfFile
let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
let attributes: [String: Any] = [kSecValueData as String: value]
let result = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
if result == errSecItemNotFound {
  var added = query
  added[kSecValueData as String] = value
  if SecItemAdd(added as CFDictionary, nil) != errSecSuccess { exit(1) }
} else if result != errSecSuccess { exit(1) }
`;

export function validateConfig(value) {
  if (!value || value.version !== 1 || typeof value.host !== 'string' || !value.host)
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
  return Object.freeze(value);
}
export async function readConfig(file = configFile) {
  try {
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
  const value = {
    version: 1,
    host,
    signalkIngress: `http://127.0.0.1:${signalkPort}/plugins/telltales-observations/observations`,
    signalkStream: `ws://127.0.0.1:${signalkPort}/signalk/v1/stream?subscribe=none`,
  };
  await mkdir(resolve(file, '..'), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
  await chmod(file, 0o600);
  return Object.freeze(value);
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
    return JSON.parse(await readFile(stateFile, 'utf8'));
  } catch {
    return {};
  }
}
async function saveState(value) {
  await mkdir(local, { recursive: true, mode: 0o700 });
  await writeFile(stateFile, `${JSON.stringify(value)}\n`, { mode: 0o600 });
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
function keychain(args) {
  const result = spawnSync('security', args, { encoding: 'utf8' });
  if (result.error)
    throw Error('macOS Keychain command is unavailable; this launcher requires the security tool');
  if (result.status !== 0)
    throw Error(result.stderr.trim() || 'macOS Keychain did not provide the requested credential');
  return result.stdout.replace(/\n$/, '');
}
export function readSecret(name) {
  return keychain(['find-generic-password', '-s', service, '-a', accounts[name], '-w']);
}
export function saveSecret(name, value) {
  if (!accounts[name] || !value) throw Error(`missing ${name} credential`);
  // security(1) requires the password as an argv value. Swift's Security
  // bridge lets the provisioning helper deliver it over stdin instead.
  const result = spawnSync('swift', ['-e', keychainSaveProgram, service, accounts[name]], {
    encoding: 'utf8',
    input: value,
  });
  if (result.error || result.status !== 0)
    throw Error(
      'macOS Keychain did not save the credential; existing Keychain items were not changed'
    );
}
export function deleteSecret(name) {
  try {
    keychain(['delete-generic-password', '-s', service, '-a', accounts[name]]);
  } catch {}
}
function requiredSecret(name) {
  try {
    return readSecret(name);
  } catch {
    throw Error(`missing or revoked ${name} Keychain credential; run make iphone-heel-credentials`);
  }
}
export const createPairingCode = (random = randomInt) => `${random(1_000_000)}`.padStart(6, '0');
export function hudLaunchDecision({ occupied, owned }) {
  if (!occupied) return 'start';
  return owned ? 'reuse' : 'refuse';
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
function openHud() {
  spawn('open', ['http://127.0.0.1:4173/?view=hud&template=sailing-hud&mode=signalk'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}
async function run(role) {
  const config = await readConfig(),
    env = { ...process.env, TELLTALES_SERVER_HOST: config.host };
  let command;
  if (role === 'producer') {
    env.SIGNALK_TOKEN = requiredSecret('producer');
    env.SIGNALK_INGRESS_TOKEN = requiredSecret('ingress');
    env.SIGNALK_INGRESS = config.signalkIngress;
    const pairing = createPairingCode();
    saveSecret('pairing', pairing);
    env.IPHONE_HEEL_PAIRING_CODE = pairing;
    command = ['node', 'experiments/iphone-heel/server.mjs'];
  } else {
    const decision = hudLaunchDecision({
      occupied: await portOpen(4173),
      owned: await ownedProcess('hud'),
    });
    if (decision === 'reuse') {
      console.log('Reusing the existing experiment-owned authenticated HUD server.');
      openHud();
      return;
    }
    if (decision === 'refuse')
      throw Error(
        'port 4173 already has a web server; it is not experiment-owned, so it was left running. Stop it yourself or use its existing authenticated iPhone HUD launcher.'
      );
    env.TELLTALES_SIGNALK_STREAM = config.signalkStream;
    env.TELLTALES_SIGNALK_STREAM_TOKEN = requiredSecret('viewer');
    command = ['node', 'scripts/server.mjs'];
  }
  const child = spawn(command[0], command.slice(1), { cwd: root, env, stdio: 'inherit' }),
    clear = () => role === 'producer' && deleteSecret('pairing');
  await register(role, child.pid);
  if (role === 'hud') {
    for (let tries = 0; tries < 20 && !(await portOpen(4173)); tries += 1)
      await new Promise((resolve) => setTimeout(resolve, 50));
    if (await portOpen(4173)) openHud();
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
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
async function status() {
  const state = await readState(),
    config = await readConfig().catch(() => null);
  const report = {
    configured: Boolean(config),
    signalK: await portOpen(3000),
    web: await portOpen(4173),
    processes: {},
  };
  for (const [role, item] of Object.entries(state)) {
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
  for (const [role, item] of Object.entries(state)) {
    const command = spawnSync('ps', ['-p', `${item.pid}`, '-o', 'command='], {
      encoding: 'utf8',
    }).stdout;
    const expected =
      role === 'producer' ? 'experiments/iphone-heel/server.mjs' : 'scripts/server.mjs';
    if (!command.includes(expected)) {
      console.log(`No matching experiment-owned ${role} process; left PID ${item.pid} untouched.`);
      continue;
    }
    process.kill(item.pid, 'SIGTERM');
    console.log(`Stopped experiment-owned ${role} process.`);
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
    saveSecret(arguments_[0], value);
  } else if (command === 'pairing-code') console.log(requiredSecret('pairing'));
  else if (command === 'host') console.log((await readConfig()).host);
  else if (command === 'producer' || command === 'hud') await run(command);
  else if (command === 'status') await status();
  else if (command === 'stop') await stop();
  else throw Error('usage: iphone-heel-local.mjs setup|save-secret|pairing-code|producer|hud');
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(`iPhone heel: ${error.message}`);
    process.exitCode = 2;
  });
