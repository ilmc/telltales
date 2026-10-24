import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNmeaRmc } from '../src/core.mjs';
const sog = { id: 'vessel.speedOverGround', unit: 'kn', minimum: 0, maximum: 20 };
test('checksummed GP/GN RMC maps SOG knots with original UTC time and file provenance', () => {
  const parsed = parseNmeaRmc(
    readFileSync(new URL('../examples/synthetic-rmc.nmea', import.meta.url), 'utf8'),
    sog,
    { synthetic: true }
  );
  assert.deepEqual(
    parsed.events.map((e) => [
      e.value,
      e.valid,
      e.simulated,
      e.provenance.kind,
      e.provenance.synthetic,
    ]),
    [
      [3.2, true, false, 'nmea-0183-rmc-file', true],
      [7.8, true, false, 'nmea-0183-rmc-file', true],
      [null, false, false, 'nmea-0183-rmc-file', true],
    ]
  );
  assert.equal(parsed.events[1].observedAt, '2026-10-21T12:00:02.000Z');
});
test('RMC retains bad checksum and rejects unsupported, malformed-time input', () => {
  const good = '$GPRMC,120000.00,A,0000.000,N,00000.000,E,3.2,0.0,211026,,,A*5A';
  assert.equal(parseNmeaRmc(good.replace('*5A', '*00'), sog).events[0].valid, false);
  for (const line of [
    '$GPRMC,120000.00,V,0000.000,N,00000.000,E,3.2,0.0,211026,,,A*4D',
    '$GPRMC,120000.00,A,0000.000,N,00000.000,E,,0.0,211026,,,A*7C',
    '$GPRMC,120000.00,A,0000.000,N,00000.000,E,99.0,0.0,211026,,,A*6E',
  ])
    assert.equal(parseNmeaRmc(line, sog).events[0].valid, false);
  assert.throws(() => parseNmeaRmc('$GPRMC,bad,A,,,,,3.2,,,211026*00', sog));
  assert.throws(() => parseNmeaRmc('$IIRMC,120000.00,A,,,,,3.2,0.0,211026,,,A*00', sog));
});
