// experiments/iphone-heel/server.mjs
import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { createPairing, parseCookies } from './auth.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname),
  directory = resolve(root, 'experiments/iphone-heel');
const cert = process.env.IPHONE_HEEL_CERT_DIR || resolve(root, '.local/iphone-heel-cert');
const token = process.env.SIGNALK_TOKEN,
  ingressToken = process.env.SIGNALK_INGRESS_TOKEN;
if (!token || !ingressToken)
  throw Error('Set SIGNALK_TOKEN and SIGNALK_INGRESS_TOKEN; they are never sent to the phone.');
const pairing = await createPairing({
  file: process.env.IPHONE_HEEL_PAIRINGS || resolve(root, '.local/iphone-heel-pairings.json'),
  code: process.env.IPHONE_HEEL_PAIRING_CODE,
});
const ingress =
  process.env.SIGNALK_INGRESS ||
  'http://127.0.0.1:3000/plugins/telltales-observations/observations';
let owner,
  fingerprint = '',
  lastPhoneReadingAt = 0;
async function publish(reading) {
  const observation = {
    id: 'vessel.heel',
    unit: 'deg',
    value: reading.valid ? reading.value : null,
    valid: Boolean(reading.valid),
    reason: reading.reason || null,
    observedAt: new Date().toISOString(),
    sourceId: 'iphone-browser-motion',
    simulated: false,
    provenance: {
      kind: 'browser-phone-motion',
      transport: 'paired-local-https-wss',
      calibration: 'manual-zero',
    },
  };
  const next = `${observation.valid}|${observation.value}|${observation.reason}`;
  if (next === fingerprint) return;
  const response = await fetch(ingress, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-telltales-ingress-token': `Bearer ${ingressToken}`,
    },
    body: JSON.stringify(observation),
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw Error(`Signal K ingress HTTP ${response.status}`);
  fingerprint = next;
}
const server = createServer(
  {
    key: await readFile(`${cert}/iphone-heel.key`),
    cert: await readFile(`${cert}/iphone-heel.crt`),
  },
  async (req, res) => {
    const url = new URL(req.url, 'https://local');
    if (url.pathname === '/auth/pair' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let credential;
      try {
        credential = await pairing.pair(JSON.parse(body).code);
      } catch {}
      if (!credential) return res.writeHead(401).end();
      return res
        .writeHead(201, {
          'set-cookie': `iphone_heel_device=${credential}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        })
        .end();
    }
    if (url.pathname === '/certificate.cer') {
      try {
        return res
          .writeHead(200, { 'content-type': 'application/pkix-cert' })
          .end(await readFile(`${cert}/iphone-heel.cer`));
      } catch {
        return res.writeHead(404).end();
      }
    }
    const file = url.pathname === '/' ? 'phone.html' : url.pathname.slice(1);
    if (!['phone.html', 'phone.mjs', 'src/iphone-heel-orientation.mjs'].includes(file))
      return res.writeHead(404).end();
    res
      .writeHead(200, {
        'content-type': file.endsWith('html') ? 'text/html' : 'text/javascript',
        'cache-control': 'no-store',
      })
      .end(await readFile(resolve(file.startsWith('src/') ? root : directory, file)));
  }
);
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', async (req, socket, head) => {
  if (
    new URL(req.url, 'https://local').pathname !== '/stream' ||
    !(await pairing.authenticate(parseCookies(req.headers.cookie).iphone_heel_device))
  )
    return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});
wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return ws.close(1008);
    }
    if (message.type === 'hello' && message.role === 'phone') {
      if (owner && owner !== ws) owner.close(4001, 'replaced');
      owner = ws;
      return;
    }
    if (
      owner !== ws ||
      message.type !== 'heel' ||
      (message.valid && (!Number.isFinite(message.value) || Math.abs(message.value) > 85))
    )
      return;
    lastPhoneReadingAt = Date.now();
    try {
      await publish(message);
    } catch {
      ws.send(JSON.stringify({ type: 'status', text: 'Signal K ingress unavailable' }));
    }
  });
  ws.on('close', () => {
    if (owner === ws) {
      owner = null;
      void publish({ valid: false, reason: 'iPhone disconnected or backgrounded' });
    }
  });
});
const port = Number(process.env.IPHONE_HEEL_PORT || 8443);
setInterval(() => {
  if (owner && Date.now() - lastPhoneReadingAt > 3000)
    void publish({ valid: false, reason: 'iPhone reading stale or backgrounded' });
}, 750).unref();
server.listen(port, process.env.IPHONE_HEEL_HOST || '0.0.0.0', () =>
  console.log(`Phone: https://<Mac LAN IP>:${port}/ · certificate: /certificate.cer`)
);
