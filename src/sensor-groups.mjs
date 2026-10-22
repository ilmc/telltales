// Optional Issue #8 sensor-group contract. Legacy config and buses are unchanged.
// This layer does not implement remote transport or reinterpret cross-vessel wind.
const finite = x => typeof x === 'number' && Number.isFinite(x);
const frames = new Set(['own-vessel','other-vessel','fixed-site']);
const contexts = new Set(['own-vessel','other-vessel','fixed-site','phone']);
const fail = message => { throw Error(message); };
const unique = (array, what) => {
  const ids = new Set();
  for (const item of array) {
    if (typeof item?.id !== 'string' || !item.id || ids.has(item.id)) fail(`Duplicate or invalid ${what} ID`);
    ids.add(item.id);
  }
};
export function validateSensorCatalog(catalog) {
  if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.providers) ||
      !Array.isArray(catalog.groups) || !Array.isArray(catalog.sessions)) fail('Invalid sensor catalog');
  unique(catalog.providers, 'provider');
  unique(catalog.groups, 'group');
  unique(catalog.sessions, 'session');
  const providers = new Map();
  for (const p of catalog.providers) {
    if (!contexts.has(p.context) || typeof p.label !== 'string' || !p.label.trim() ||
        !Array.isArray(p.channels) || !p.channels.length) fail('Invalid provider context or channels');
    unique(p.channels, 'channel');
    for (const ch of p.channels) {
      if (!ch.observation || !ch.unit || !frames.has(ch.frame) ||
          (ch.frame === 'own-vessel' && p.context !== 'own-vessel' && p.context !== 'phone') ||
          (ch.frame === 'other-vessel' && p.context !== 'other-vessel') ||
          (ch.frame === 'fixed-site' && p.context !== 'fixed-site')) fail('Invalid channel semantics');
    }
    providers.set(p.id, p);
  }
  const groups = new Map();
  for (const group of catalog.groups) {
    if (!Array.isArray(group.bindings) || !group.bindings.length) fail('Empty sensor group');
    unique(group.bindings, 'binding');
    for (const b of group.bindings) {
      if (!b.observation || !b.unit || !frames.has(b.frame) ||
          !Array.isArray(b.candidates) || !b.candidates.length ||
          new Set(b.candidates.map(x => `${x.provider}/${x.channel}`)).size !== b.candidates.length)
        fail('Invalid group binding');
      for (const choice of b.candidates) {
        const ch = providers.get(choice.provider)?.channels.find(x => x.id === choice.channel);
        if (!ch) fail('Missing provider/channel');
        if (ch.observation !== b.observation || ch.unit !== b.unit || ch.frame !== b.frame)
          fail('Incompatible observation unit or reference frame');
      }
    }
    groups.set(group.id, group);
  }
  for (const s of catalog.sessions) {
    if (!groups.has(s.group) || typeof s.template !== 'string' || !s.template.trim())
      fail('Invalid session template or group');
  }
  return catalog;
}
export function createSensorSession(catalog, sessionId, emit = () => {}, now = () => Date.now()) {
  validateSensorCatalog(catalog);
  const session = catalog.sessions.find(x => x.id === sessionId);
  if (!session) fail('Unknown session');
  let groupId = session.group;
  const latest = new Map();
  const group = () => catalog.groups.find(x => x.id === groupId);
  const read = binding => {
    let missing = 'No selected provider observation';
    for (const choice of binding.candidates) {
      const provider = catalog.providers.find(x => x.id === choice.provider);
      const channel = provider.channels.find(x => x.id === choice.channel);
      const observation = latest.get(`${provider.id}/${channel.id}`);
      if (!observation) continue;
      const timestamp = Date.parse(observation.observedAt);
      if (observation.observation !== binding.observation ||
          observation.unit !== binding.unit || observation.frame !== binding.frame ||
          !observation.valid || !finite(observation.value) ||
          !Number.isFinite(timestamp) || timestamp > now() + 1000 ||
          now() - timestamp > (binding.maxAgeMs ?? 30000)) {
        missing = 'Selected observation invalid, stale or incompatible';
        continue;
      }
      return {ok:true, value:observation.value, observation:binding.observation,
        unit:binding.unit, frame:binding.frame, providerId:provider.id,
        channelId:channel.id, providerLabel:provider.label,
        fallback:choice !== binding.candidates[0], observedAt:observation.observedAt,
        simulated:observation.simulated};
    }
    return {ok:false, observation:binding.observation, unit:binding.unit,
      frame:binding.frame, reason:missing};
  };
  const snapshot = () => Object.fromEntries(group().bindings.map(b => [b.id, read(b)]));
  const notify = () => { const values = snapshot(); emit({sessionId,groupId,template:session.template,values}); return values; };
  return {
    dispatch(r) {
      const provider = catalog.providers.find(x => x.id === r?.providerId);
      const ch = provider?.channels.find(x => x.id === r?.channelId);
      if (!ch || r.observation !== ch.observation || r.unit !== ch.unit ||
          r.frame !== ch.frame || typeof r.simulated !== 'boolean') return false;
      latest.set(`${provider.id}/${ch.id}`, {...r}); notify(); return true;
    },
    selectGroup(id) {
      if (!catalog.groups.some(g => g.id === id)) fail('Unknown sensor group');
      groupId = id;
      latest.clear(); // never inherit observations from a previous sailing context
      return notify();
    },
    refresh: notify,
    get groupId() { return groupId; },
    get template() { return session.template; },
    snapshot
  };
}
