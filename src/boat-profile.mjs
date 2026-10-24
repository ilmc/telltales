// A local-only authoring artifact. It deliberately reuses the sensor-group
// provider and binding contract instead of adding a second configuration model.
import { validateSensorCatalog } from './sensor-groups.mjs';
const fail = (x) => {
    throw Error(x);
  },
  named = (x) => typeof x === 'string' && /^[a-z][a-z0-9-]*$/.test(x),
  state = (x) => x === 'known' || x === 'unknown';
export function validateBoatProfile(p) {
  if (
    !p ||
    p.format !== 'telltales.boat-profile' ||
    p.version !== 1 ||
    p.privacy !== 'local-only' ||
    !named(p.id) ||
    typeof p.label !== 'string' ||
    !p.label.trim() ||
    !Array.isArray(p.providers) ||
    !p.sensorGroup
  )
    fail('Invalid local boat profile');
  let bindings = p.sensorGroup.bindings;
  if (!named(p.sensorGroup.id) || !Array.isArray(bindings) || !bindings.length)
    fail('Invalid local boat sensor group');
  let inputs = bindings.map((b) => ({
    id: b.id,
    observation: b.observation,
    unit: b.unit,
    frame: b.frame,
    required: false,
  }));
  validateSensorCatalog({
    version: 2,
    providers: p.providers,
    groups: [p.sensorGroup],
    templates: [{ id: 'profile-contract', inputs }],
    sessions: [{ id: 'profile-session', group: p.sensorGroup.id, template: 'profile-contract' }],
  });
  for (const provider of p.providers)
    for (const channel of provider.channels) {
      let installation = channel.installation;
      if (!installation || !state(installation.calibration))
        fail('Boat profile calibration must be known or unknown');
      if (
        channel.observation === 'environment.depth' &&
        (!state(installation.offset) ||
          !['unknown', 'transducer', 'keel', 'waterline'].includes(installation.depthDatum))
      )
        fail('Boat profile depth datum and offset must be known or unknown');
    }
  return p;
}
