// experiments/iphone-heel/server.mjs
// Temporary paired-phone producer: phone measurement time remains distinct from
// server receipt time, while one serialized queue keeps Signal K transitions ordered.
import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { createPairing, parseCookies } from './auth.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const directory = resolve(root, 'experiments/iphone-heel');
const nowIso = () => new Date().toISOString();
const validPhoneReading = (message, now) => {
  const observedAt = Date.parse(message?.observedAt);
  return (
    message?.type === 'heel' &&
    typeof message.valid === 'boolean' &&
    typeof message.method === 'string' &&
    typeof message.calibration === 'string' &&
    Number.isFinite(observedAt) &&
    observedAt <= now + 1000 &&
    observedAt >= now - 5000 &&
    (!message.valid ||
      (Number.isFinite(message.value) &&
        Math.abs(message.value) <= 85 &&
        message.calibration === 'manual-zero'))
  );
};

export function createIphoneHeelProducer({
  tls,
  pairing,
  publishIngress,
  certificate,
  clock = Date.now,
  heartbeatMs = 1000,
  staleMs = 3000,
  pairingAttempts = 5,
  pairingWindowMs = 15 * 60_000,
}) {
  let owner = null;
  let lastPhoneReadingAt = 0;
  let lastFingerprint = '';
  let lastPublishedAt = 0;
  let pendingInvalidation = null;
  let invalidatedReason = '';
  let chain = Promise.resolve();
  const attempts = new Map();
  const queue = (work) => {
    const task = chain.then(work, work);
    chain = task.catch(() => {});
    return task;
  };
  const ingress = async (reading, receivedAt = nowIso()) => {
    const observation = {
      id: 'vessel.heel',
      unit: 'deg',
      value: reading.valid ? reading.value : null,
      valid: Boolean(reading.valid),
      reason: reading.reason || null,
      observedAt: reading.observedAt || receivedAt,
      sourceId: 'iphone-browser-motion',
      simulated: false,
      provenance: {
        kind: 'browser-phone-motion',
        transport: 'paired-local-https-wss',
        method: reading.method || 'server-invalidation',
        calibration: reading.calibration || 'not-calibrated',
        sourceObservedAt: reading.observedAt || null,
        serverReceivedAt: receivedAt,
      },
    };
    const fingerprint = `${observation.valid}|${observation.value}|${observation.reason}`;
    const now = clock();
    if (observation.valid && fingerprint === lastFingerprint && now - lastPublishedAt < heartbeatMs)
      return;
    await publishIngress(observation);
    lastFingerprint = fingerprint;
    lastPublishedAt = now;
    if (!observation.valid) {
      pendingInvalidation = null;
      invalidatedReason = observation.reason;
    } else invalidatedReason = '';
  };
  const publish = (reading) => queue(() => ingress(reading));
  const invalidate = (reason) => {
    if (reason === invalidatedReason) return Promise.resolve();
    pendingInvalidation = { valid: false, reason, observedAt: nowIso() };
    return publish(pendingInvalidation);
  };
  const server = createServer(tls, async (req, res) => {
    const url = new URL(req.url, 'https://local');
    if (url.pathname === '/auth/pair' && req.method === 'POST') {
      const address = req.socket.remoteAddress || 'unknown';
      const record = attempts.get(address) || { count: 0, startedAt: clock() };
      if (clock() - record.startedAt > pairingWindowMs)
        Object.assign(record, { count: 0, startedAt: clock() });
      if (record.count >= pairingAttempts) return res.writeHead(429).end();
      let credential;
      try {
        let body = '';
        for await (const chunk of req) body += chunk;
        credential = await pairing.pair(JSON.parse(body).code, clock());
      } catch {}
      if (!credential) {
        record.count += 1;
        attempts.set(address, record);
        return res.writeHead(401).end();
      }
      attempts.delete(address);
      return res
        .writeHead(201, {
          'set-cookie': `iphone_heel_device=${credential}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        })
        .end();
    }
    if (url.pathname === '/certificate.cer' && certificate)
      return res.writeHead(200, { 'content-type': 'application/pkix-cert' }).end(certificate);
    const file = url.pathname === '/' ? 'phone.html' : url.pathname.slice(1);
    if (!['phone.html', 'phone.mjs', 'src/iphone-heel-orientation.mjs'].includes(file))
      return res.writeHead(404).end();
    res
      .writeHead(200, {
        'content-type': file.endsWith('html') ? 'text/html' : 'text/javascript',
        'cache-control': 'no-store',
      })
      .end(await readFile(resolve(file.startsWith('src/') ? root : directory, file)));
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', async (req, socket, head) => {
    if (
      new URL(req.url, 'https://local').pathname !== '/stream' ||
      !(await pairing.authenticate(parseCookies(req.headers.cookie).iphone_heel_device, clock()))
    )
      return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
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
      const now = clock();
      if (owner !== ws || !validPhoneReading(message, now)) return;
      lastPhoneReadingAt = now;
      publish(message).catch(() => {
        if (ws.readyState === ws.OPEN)
          ws.send(JSON.stringify({ type: 'status', text: 'Signal K ingress unavailable' }));
      });
    });
    ws.on('close', () => {
      if (owner === ws) {
        owner = null;
        invalidate('iPhone disconnected or backgrounded').catch(() => {});
      }
    });
  });
  const watchdog = setInterval(
    () => {
      if (owner && clock() - lastPhoneReadingAt > staleMs)
        invalidate('iPhone reading stale or backgrounded').catch(() => {});
      else if (pendingInvalidation) publish(pendingInvalidation).catch(() => {});
    },
    Math.min(750, heartbeatMs)
  );
  watchdog.unref();
  return Object.freeze({
    server,
    close: () => {
      clearInterval(watchdog);
      wss.close();
      return new Promise((resolve) => server.close(resolve));
    },
  });
}

async function main() {
  const cert = process.env.IPHONE_HEEL_CERT_DIR || resolve(root, '.local/iphone-heel-cert');
  const token = process.env.SIGNALK_TOKEN;
  const ingressToken = process.env.SIGNALK_INGRESS_TOKEN;
  if (!token || !ingressToken)
    throw Error('Set SIGNALK_TOKEN and SIGNALK_INGRESS_TOKEN; they are never sent to the phone.');
  const pairing = await createPairing({
    file: process.env.IPHONE_HEEL_PAIRINGS || resolve(root, '.local/iphone-heel-pairings.json'),
    code: process.env.IPHONE_HEEL_PAIRING_CODE,
  });
  const ingress =
    process.env.SIGNALK_INGRESS ||
    'http://127.0.0.1:3000/plugins/telltales-observations/observations';
  const producer = createIphoneHeelProducer({
    tls: {
      key: await readFile(`${cert}/iphone-heel.key`),
      cert: await readFile(`${cert}/iphone-heel.crt`),
    },
    certificate: await readFile(`${cert}/iphone-heel.cer`),
    pairing,
    publishIngress: async (observation) => {
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
    },
  });
  const port = Number(process.env.IPHONE_HEEL_PORT || 8443);
  producer.server.listen(port, process.env.IPHONE_HEEL_HOST || '0.0.0.0', () =>
    console.log('Phone: https://<Mac LAN IP>:8443/ · pair within 15 minutes')
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname) await main();
