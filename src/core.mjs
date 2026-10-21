/**
 * @typedef {{id:string,unit:'deg',value:number|null,observedAt:string,sourceId:string,valid:boolean,reason?:string,simulated:true}} Observation
 * @typedef {{version:1,observation:{id:string,unit:'deg',minimum:number,maximum:number,reference:string},sources:Array<{id:string,type:'slider'|'fixture',initial?:number,samples?:number[]}>,defaultSource:string,renderer:{type:'heel-gauge',observation:string,title:string}}} Configuration
 */
/** Fail closed: invalid data never becomes a displayed number. */
export function validateConfiguration(config) {
  if (!config || config.version !== 1 || config.observation?.id !== 'vessel.heel' ||
      config.observation.unit !== 'deg' || config.observation.minimum !== -90 ||
      config.observation.maximum !== 90 || typeof config.observation.reference !== 'string' ||
      config.renderer?.type !== 'heel-gauge' || config.renderer.observation !== config.observation.id ||
      !Array.isArray(config.sources) || config.sources.length < 2) throw new Error('Invalid configuration or unsupported contract');
  const ids = new Set();
  for (const source of config.sources) {
    if (!source || typeof source.id !== 'string' || !source.id.trim() || ids.has(source.id)) throw new Error('Duplicate/invalid source ID');
    ids.add(source.id);
    if (source.type === 'slider') {
      if (!isHeel(source.initial)) throw new Error('Invalid slider initial value');
    } else if (source.type === 'fixture') {
      if (!Array.isArray(source.samples) || source.samples.length === 0 || !source.samples.every(isHeel)) throw new Error('Invalid fixture samples');
    } else throw new Error('Unknown source type');
  }
  if (config.sources.filter(source => source.type === 'slider').length !== 1 ||
      config.sources.filter(source => source.type === 'fixture').length !== 1) throw new Error('Exactly one slider and one fixture source are required');
  if (!ids.has(config.defaultSource)) throw new Error('Default source not found');
  return config;
}
function isHeel(value) { return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90; }
export function observation(sourceId, value, options = {}) {
  const {at = new Date(), reason} = options;
  const observedAt = at instanceof Date ? at.toISOString() : at;
  const valid = isHeel(value) && typeof sourceId === 'string' && !!sourceId &&
    typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)) && !reason;
  return Object.freeze({
    id:'vessel.heel', unit:'deg', value:valid ? value : null, observedAt,
    sourceId, valid:Boolean(valid), simulated:true,
    ...(!valid ? {reason:reason || 'Invalid or missing observation'} : {})
  });
}
export function acceptable(reading, config, now = Date.now(), maxAgeMs = 30000) {
  if (!reading || reading.id !== config.observation.id || reading.unit !== config.observation.unit ||
      reading.simulated !== true || reading.valid !== true || !isHeel(reading.value) ||
      !config.sources.some(s => s.id === reading.sourceId)) return {ok:false,reason:'Invalid or unrecognised observation'};
  const time = Date.parse(reading.observedAt);
  if (!Number.isFinite(time) || time > now + 1000 || now - time > maxAgeMs) return {ok:false,reason:'Stale or future observation'};
  return {ok:true,value:reading.value};
}
export function createSource(spec, emit, clock = () => new Date()) {
  if (spec.type === 'slider') return {
    id:spec.id,
    start(){ emit(observation(spec.id,spec.initial,{at:clock()})); },
    set(value){ emit(observation(spec.id,value,{at:clock()})); },
    invalid(){emit(observation(spec.id,NaN,{at:clock(),reason:'Sensor reports invalid'}));},
    missing(){emit(observation(spec.id,null,{at:clock(),reason:'No observation'}));}
  };
  if (spec.type === 'fixture') {
    let index = 0;
    return {
      id:spec.id,
      start(){index=0;emit(observation(spec.id,spec.samples[0],{at:clock()}));},
      next(){index=(index+1)%spec.samples.length;emit(observation(spec.id,spec.samples[index],{at:clock()}));},
      invalid(){emit(observation(spec.id,NaN,{at:clock(),reason:'Fixture invalid'}));},
      missing(){emit(observation(spec.id,null,{at:clock(),reason:'Fixture missing'}));}
    };
  }
  throw new Error('Unknown source adapter');
}
export function createBus(config, sink, now = () => Date.now()) {
  let activeSource = config.defaultSource;
  let latest = null;
  const dispatch = reading => {
    if (reading.sourceId !== activeSource) return;
    latest = reading;
    sink(reading,acceptable(reading,config,now()));
  };
  return {
    dispatch,
    select(id) {
      if (!config.sources.some(s=>s.id===id)) throw new Error('Unknown source');
      activeSource=id; latest=null; sink(null,{ok:false,reason:'Awaiting source observation'});
    },
    refresh(){sink(latest,acceptable(latest,config,now()));},
    get activeSource(){return activeSource;}
  };
}

