// test/iphone-heel-orientation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHeelOrientation,
  gravityFromMotion,
  gravityFromOrientation,
} from '../src/iphone-heel-orientation.mjs';

const gravityAtHeel = (degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians) * 9.81, y: 0, z: Math.cos(radians) * 9.81 };
};

test('signed heel works without flipping at large supported angles', () => {
  const sensor = createHeelOrientation();
  assert.equal(sensor.calibrate(gravityAtHeel(0)).ok, true);
  for (const angle of [-84, -60, -30, -10, 0, 10, 30, 60, 84]) {
    const result = sensor.measure(gravityAtHeel(angle));
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.heel - angle) < 1e-9);
  }
});

test('out-of-range inclinations and edge-on mounting fail closed', () => {
  const sensor = createHeelOrientation();
  sensor.calibrate(gravityAtHeel(0));
  for (const angle of [-89, -86, 86, 89]) {
    const result = sensor.measure(gravityAtHeel(angle));
    assert.equal(result.ok, false);
    assert.match(result.reason, /supported/);
  }
  assert.match(
    createHeelOrientation().calibrate({ x: 0, y: 9.81, z: 0 }).reason,
    /Unsupported mount/
  );
});

test('Safari beta/gamma fallback supports calibration and signed measurement', () => {
  const sensor = createHeelOrientation();
  const zero = gravityFromOrientation({ beta: 0, gamma: 0 });
  assert.equal(sensor.calibrate(zero).ok, true);
  for (const angle of [-60, -30, 0, 30, 60]) {
    const result = sensor.measure(gravityFromOrientation({ beta: 0, gamma: angle }));
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.heel - angle) < 1e-9);
  }
  assert.equal(sensor.calibrated, true);
  sensor.reset();
  assert.equal(sensor.calibrated, false);
  assert.match(sensor.measure(zero).reason, /Zero/);
});

test('unavailable browser gravity and malformed readings are rejected', () => {
  assert.equal(gravityFromMotion({ accelerationIncludingGravity: { x: 1 } }), null);
  assert.equal(gravityFromOrientation({ beta: 0, gamma: null }), null);
  assert.deepEqual(gravityFromMotion({ accelerationIncludingGravity: { x: 1, y: 2, z: 3 } }), {
    x: 1,
    y: 2,
    z: 3,
    source: 'devicemotion gravity',
  });
  const sensor = createHeelOrientation();
  assert.equal(sensor.calibrate(null).ok, false);
  assert.equal(sensor.measure(null).ok, false);
});
