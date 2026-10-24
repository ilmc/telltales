import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNmeaMwv } from '../src/core.mjs';
const speed = { id: 'environment.wind.apparentSpeed', unit: 'kn', minimum: 0, maximum: 80 },
  angle = { id: 'environment.wind.apparentAngle', unit: 'deg', minimum: -180, maximum: 180 };
const cs = (s) => {
    let x = 0;
    for (const c of s) x ^= c.charCodeAt(0);
    return x.toString(16).padStart(2, '0').toUpperCase();
  },
  line = (a, r, v, u, status = 'A') => {
    let x = `IIMWV,${a},${r},${v},${u},${status}`;
    return `2026-10-21T12:00:00.000Z | $${x}*${cs(x)}`;
  };
test('MWV validates checksum, apparent reference, units, angle convention and provenance', () => {
  let d = parseNmeaMwv(
    [line('270.0', 'R', '18.52', 'K'), line('180.0', 'R', '10', 'N')].join('\n'),
    speed,
    angle
  );
  assert.equal(d.events[0].value, 10);
  assert.equal(d.events[1].value, -90);
  assert.equal(d.events[3].value, 180);
  assert.equal(d.events[0].provenance.timing, 'recorded-envelope');
  assert.equal(d.events[0].simulated, false);
});
test('MWV preserves invalid paired readings and rejects unwrapped/true/unsupported data', () => {
  let d = parseNmeaMwv(line('10', 'T', '3', 'N'), speed, angle);
  assert.equal(d.events[0].valid, false);
  assert.match(d.events[0].reason, /true wind/);
  assert.throws(() => parseNmeaMwv('$IIMWV,1,R,2,N,A*00', speed, angle));
  let bad = parseNmeaMwv(line('1', 'R', '2', 'X'), speed, angle);
  assert.equal(bad.events[0].valid, false);
});
