'use strict';
// Supported Signal K server plugin: receives only local, authenticated Telltales observations.
const KNOT = 1852 / 3600,
  paths = {
    'vessel.speedOverGround': 'navigation.speedOverGround',
    'vessel.speedThroughWater': 'navigation.speedThroughWater',
    'environment.wind.apparentSpeed': 'environment.wind.speedApparent',
    'environment.wind.apparentAngle': 'environment.wind.angleApparent',
    'vessel.heel': 'navigation.attitude.roll',
    'environment.depth': 'environment.depth.telltalesUnknownReference',
  };
const units = {
  'vessel.speedOverGround': 'kn',
  'vessel.speedThroughWater': 'kn',
  'environment.wind.apparentSpeed': 'kn',
  'environment.wind.apparentAngle': 'deg',
  'vessel.heel': 'deg',
  'environment.depth': 'm',
};
const limits = {
  'vessel.speedOverGround': [0, 20],
  'vessel.speedThroughWater': [0, 20],
  'environment.wind.apparentSpeed': [0, 80],
  'environment.wind.apparentAngle': [-180, 180],
  'vessel.heel': [-90, 90],
  'environment.depth': [0, 100],
};
const valid = (x) =>
  x &&
  paths[x.id] &&
  x.unit === units[x.id] &&
  typeof x.sourceId === 'string' &&
  typeof x.simulated === 'boolean' &&
  Number.isFinite(Date.parse(x.observedAt)) &&
  (x.valid === false ||
    (typeof x.value === 'number' && x.value >= limits[x.id][0] && x.value <= limits[x.id][1]));
const convert = (o) =>
  o.unit === 'kn' ? o.value * KNOT : o.unit === 'deg' ? (o.value * Math.PI) / 180 : o.value;
const origin = 'http://localhost:4173',
  cors = (res) =>
    res
      .set('Access-Control-Allow-Origin', origin)
      .set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Telltales-Ingress-Token')
      .set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .set('Vary', 'Origin');
module.exports = function (app) {
  let token;
  let plugin = {
    id: 'telltales-observations',
    name: 'Telltales observations',
    description: 'Local authenticated simulator ingress',
  };
  plugin.schema = {
    type: 'object',
    properties: {
      token: { type: 'string', title: 'Local ingress token' },
      enabled: { type: 'boolean', default: true },
    },
  };
  const ingress = (req, res) => {
    cors(res);
    if (!token || req.get('x-telltales-ingress-token') !== `Bearer ${token}`)
      return res.status(401).json({ error: 'invalid ingress token' });
    let o = req.body;
    if (!valid(o)) return res.status(400).json({ error: 'invalid observation' });
    let meta = {
      id: o.id,
      unit: o.unit,
      sourceId: o.sourceId,
      valid: o.valid !== false,
      simulated: o.simulated,
      observedAt: o.observedAt,
      reason: o.reason || null,
      replay: o.replay || null,
      provenance: o.provenance || null,
    };
    app.handleMessage(plugin.id, {
      context: 'vessels.self',
      updates: [
        {
          timestamp: o.observedAt,
          source: { label: `telltales:${o.sourceId}`, type: 'other' },
          values: [
            { path: paths[o.id], value: o.valid === false ? null : convert(o) },
            { path: `telltales.observationMeta.${o.id.replace(/\./g, '_')}`, value: meta },
          ],
        },
      ],
    });
    res.status(202).json({ accepted: true });
  };
  plugin.registerWithRouter = (router) => {
    router.access('readwrite').post('/observations', ingress);
    router.options('/observations', (req, res) => cors(res).sendStatus(204));
  };
  plugin.start = (options) => {
    token = options.token;
    if (!token) app.debug('Telltales plugin disabled: configure a token');
  };
  plugin.stop = () => {};
  return plugin;
};
