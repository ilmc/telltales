// experiments/iphone-heel/phone.mjs
import {
  createHeelOrientation,
  gravityFromMotion,
  gravityFromOrientation,
} from '../../src/iphone-heel-orientation.mjs';
const $ = (id) => document.querySelector(id),
  sensor = createHeelOrientation();
let ws,
  enabled = false,
  gravity,
  nativeAt = 0,
  lastSent = 0,
  lastFailure = '';
const send = (value, valid, reason, sample = gravity) =>
  ws?.readyState === WebSocket.OPEN &&
  ws.send(
    JSON.stringify({
      type: 'heel',
      value,
      valid,
      reason,
      observedAt: sample?.observedAt || new Date().toISOString(),
      method: sample?.source || 'no-browser-sensor',
      calibration: sensor.calibrated ? 'manual-zero' : 'not-calibrated',
    })
  );
function publish(v) {
  gravity = v || gravity;
  const r = sensor.measure(v);
  $('#value').textContent = r.ok ? r.heel.toFixed(1) : '—';
  $('#side').textContent = r.ok
    ? r.heel < -0.5
      ? 'PORT'
      : r.heel > 0.5
        ? 'STARBOARD'
        : 'UPRIGHT'
    : r.reason;
  const now = Date.now();
  if (r.ok && now - lastSent > 200) {
    send(r.heel, true, null, v);
    lastSent = now;
    lastFailure = '';
  } else if (!r.ok && r.reason !== lastFailure) {
    send(null, false, r.reason, v);
    lastFailure = r.reason;
  }
}
function connect() {
  ws = new WebSocket(location.href.replace(/^https/, 'wss').replace(/\/$/, '/stream'));
  ws.onopen = () => {
    $('#status').textContent = 'Connected securely · enable motion';
    ws.send(JSON.stringify({ type: 'hello', role: 'phone' }));
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
$('#pair').onclick = async () => {
  const response = await fetch('/auth/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: $('#code').value }),
  });
  if (!response.ok) return ($('#status').textContent = 'Pairing code rejected');
  $('#pairing').hidden = true;
  $('#enable').disabled = false;
  connect();
};
$('#enable').onclick = async () => {
  try {
    const types = [globalThis.DeviceMotionEvent, globalThis.DeviceOrientationEvent].filter(Boolean);
    if (!types.length) throw Error('no motion API exposed by this browser');
    for (const Type of types)
      if (Type?.requestPermission && (await Type.requestPermission()) !== 'granted')
        throw Error('permission denied');
    enabled = true;
    $('#enable').disabled = true;
    $('#zero').disabled = $('#reset').disabled = false;
    $('#status').textContent = 'Motion enabled · hold level and press Zero';
  } catch (e) {
    $('#status').textContent = `Motion permission unavailable: ${e.message}`;
  }
};
$('#zero').onclick = () => {
  if (!gravity || Date.now() - Date.parse(gravity.observedAt) > 750)
    return ($('#status').textContent = 'Zero rejected: wait for a fresh supported sensor event');
  const r = sensor.calibrate(gravity);
  if (!r.ok) return ($('#status').textContent = `Zero rejected: ${r.reason}`);
  publish(gravity);
  $('#status').textContent = `Zero set using ${gravity.source}`;
};
$('#reset').onclick = () => {
  sensor.reset();
  send(null, false, 'Mount reference reset; zero again');
};
addEventListener(
  'devicemotion',
  (e) => {
    if (enabled) {
      const v = gravityFromMotion(e, new Date().toISOString());
      if (v) {
        nativeAt = Date.now();
        publish(v);
      }
    }
  },
  { passive: true }
);
addEventListener(
  'deviceorientation',
  (e) => {
    if (enabled && Date.now() - nativeAt > 500)
      publish(gravityFromOrientation(e, new Date().toISOString()));
  },
  { passive: true }
);
