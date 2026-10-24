import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateConfiguration,
  createObservation,
  acceptable,
  createTransportState,
} from '../src/core.mjs';
import {
  SIGNALK_PATHS,
  observationToDelta,
  deltaToObservations,
  createSignalKSubscriber,
} from '../src/signalk.mjs';
const c = validateConfiguration(
    JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'))
  ),
  o = (id) => c.observations.find((x) => x.id === id),
  at = new Date('2026-10-21T12:00:00Z'),
  self = (x) => ({ ...x, context: 'vessels.self' });
test('Signal K mapping preserves every identity and canonical unit bidirectionally', () => {
  for (const [id, value, source, expected] of [
    ['vessel.speedOverGround', 10, 'virtual-sog', 5.14444],
    ['vessel.speedThroughWater', 7, 'virtual-stw', 3.60111],
    ['environment.wind.apparentSpeed', 12, 'virtual-wind-speed', 6.17333],
    ['environment.wind.apparentAngle', -90, 'virtual-wind-angle', -Math.PI / 2],
    ['vessel.heel', 20, 'virtual-heel', Math.PI / 9],
    ['environment.depth', 8, 'virtual-depth', 8],
  ]) {
    let reading = createObservation(o(id), source, value, { at }),
      delta = observationToDelta(reading),
      native = delta.updates[0].values[0],
      round = deltaToObservations(delta)[0];
    assert.equal(native.path, SIGNALK_PATHS[id]);
    assert.ok(Math.abs(native.value - expected) < 0.0001, id);
    assert.equal(round.id, id);
    assert.equal(round.unit, reading.unit);
    assert.ok(Math.abs(round.value - value) < 0.0001, id);
  }
});
test('Signal K accepts the announced self context and rejects other vessels', () => {
  let d = observationToDelta(createObservation(o('vessel.heel'), 'virtual-heel', 5, { at })),
    selfContext = 'vessels.urn:mrn:signalk:uuid:self';
  assert.equal(deltaToObservations({ ...d, context: selfContext }, { selfContext }).length, 1);
  assert.deepEqual(
    deltaToObservations(
      { ...d, context: 'vessels.urn:mrn:signalk:uuid:another-vessel' },
      { selfContext }
    ),
    []
  );
  assert.deepEqual(deltaToObservations({ ...d, context: undefined }, { selfContext }), []);
});
test('Signal K reverse mapping retains simulated/replay provenance and rejects malformed paths', () => {
  let x = createObservation(o('environment.wind.apparentAngle'), 'virtual-wind-angle', -45, {
      at,
      provenance: { kind: 'virtual' },
    }),
    d = observationToDelta(x),
    r = deltaToObservations(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].value, -45);
  assert.equal(r[0].sourceId, 'virtual-wind-angle');
  assert.equal(r[0].simulated, true);
  assert.deepEqual(
    deltaToObservations(
      self({ updates: [{ values: [{ path: 'navigation.speedOverGround', value: 'fast' }] }] })
    ),
    []
  );
});
test('Signal K invalid status, external source, and out of order protection are explicit', () => {
  let invalid = createObservation(o('vessel.speedOverGround'), 'virtual-sog', null, {
      at,
      reason: 'missing',
    }),
    r = deltaToObservations(observationToDelta(invalid))[0];
  assert.equal(r.valid, false);
  assert.equal(r.value, null);
  let external = {
    ...deltaToObservations(
      observationToDelta(createObservation(o('vessel.heel'), 'virtual-heel', 5, { at }))
    )[0],
    sourceId: 'remote-boat',
    simulated: false,
    provenance: { kind: 'signalk' },
  };
  assert.equal(acceptable(external, c, at.getTime()).ok, true);
  let got = [],
    t = createTransportState(
      c,
      (id, r) => got.push(r),
      () => at.getTime()
    );
  t.receiveObservation(external);
  t.receiveObservation({ ...external, value: 9, observedAt: new Date(at - 1000).toISOString() });
  assert.equal(got.length, 1);
});
test('Signal K invalidates whether metadata or its native null arrives first', () => {
  let socket,
    got = [];
  class FakeSocket {
    constructor() {
      socket = this;
    }
    send() {}
    close() {}
  }
  let subscriber = createSignalKSubscriber({
      url: 'ws://example.test/signalk',
      WebSocketImpl: FakeSocket,
      onObservation: (x) => got.push(x),
    }),
    meta = {
      path: 'telltales.observationMeta.vessel_heel',
      value: {
        id: 'vessel.heel',
        unit: 'deg',
        sourceId: 'phone',
        valid: false,
        simulated: false,
        observedAt: at.toISOString(),
        reason: 'Phone disconnected',
      },
    },
    nullValue = { path: SIGNALK_PATHS['vessel.heel'], value: null },
    send = (values) =>
      socket.onmessage({
        data: JSON.stringify({
          context: 'vessels.self',
          updates: [
            {
              timestamp: at.toISOString(),
              source: { label: 'telltales:phone', type: 'other' },
              values,
            },
          ],
        }),
      });
  socket.onopen();
  send([meta]);
  send([nullValue]);
  send([nullValue]);
  send([meta]);
  assert.equal(got.length, 4);
  assert.ok(got.every((x) => x.valid === false && x.value === null));
  assert.equal(got[0].reason, 'Phone disconnected');
  assert.equal(got[2].reason, 'Signal K source reports unavailable');
  subscriber.close();
});
