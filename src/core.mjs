/** Observations retain producer identity/time. Replays add delivery metadata. */
const OBSERVATION_ID = 'vessel.heel';
const UNIT = 'deg';
export const RECORDING_FORMAT = 'telltales.observation-recording';
export const RECORDING_VERSION = 1;
const isHeel = value => typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const sourceKnown = (config,id) => config.sources.some(source => source.id === id);

/** Fail closed: invalid data never becomes a displayed number. */
export function validateConfiguration(config) {
  if (!config || config.version !== 1 || config.observation?.id !== OBSERVATION_ID || config.observation.unit !== UNIT || config.observation.minimum !== -90 || config.observation.maximum !== 90 || typeof config.observation.reference !== 'string' || config.renderer?.type !== 'heel-gauge' || config.renderer.observation !== config.observation.id || !Array.isArray(config.sources) || config.sources.length < 2) throw new Error('Invalid configuration or unsupported contract');
  const ids = new Set(); let sliders=0,fixtures=0,replays=0;
  for (const source of config.sources) {
    if (!source || typeof source.id !== 'string' || !source.id.trim() || ids.has(source.id)) throw new Error('Duplicate/invalid source ID'); ids.add(source.id);
    if (source.type === 'slider') { sliders++; if (!isHeel(source.initial)) throw new Error('Invalid slider initial value'); }
    else if (source.type === 'fixture') { fixtures++; if (!Array.isArray(source.samples) || !source.samples.length || !source.samples.every(isHeel)) throw new Error('Invalid fixture samples'); }
    else if (source.type === 'replay') replays++;
    else throw new Error('Unknown source type');
  }
  if (sliders !== 1 || fixtures !== 1 || replays > 1) throw new Error('Exactly one slider and fixture, and at most one replay source, are required');
  if (!ids.has(config.defaultSource)) throw new Error('Default source not found'); return config;
}
export function observation(sourceId,value,{at=new Date(),reason}={}) {
  const observedAt=at instanceof Date ? at.toISOString() : at;
  const valid=isHeel(value) && typeof sourceId === 'string' && !!sourceId && validTime(observedAt) && !reason;
  return Object.freeze({id:OBSERVATION_ID,unit:UNIT,value:valid?value:null,observedAt,sourceId,valid:Boolean(valid),simulated:true,...(!valid?{reason:reason||'Invalid or missing observation'}:{})});
}
export function acceptable(reading,config,now=Date.now(),maxAgeMs=30000) {
  if (!reading || reading.id !== config.observation.id || reading.unit !== config.observation.unit || reading.simulated !== true || reading.valid !== true || !isHeel(reading.value) || !sourceKnown(config,reading.sourceId)) return {ok:false,reason:'Invalid or unrecognised observation'};
  if (reading.replay) {
    if (!sourceKnown(config,reading.replay.sourceId) || !config.sources.find(s=>s.id===reading.replay.sourceId && s.type==='replay') || !Number.isFinite(reading.replay.effectiveTimeMs) || reading.replay.effectiveTimeMs < 0) return {ok:false,reason:'Invalid replay provenance'};
    return {ok:true,value:reading.value}; // Original time is intentionally not a wall-clock freshness clock.
  }
  const time=Date.parse(reading.observedAt); if (!Number.isFinite(time) || time > now+1000 || now-time > maxAgeMs) return {ok:false,reason:'Stale or future observation'};
  return {ok:true,value:reading.value};
}
export function createSource(spec,emit,clock=()=>new Date()) {
  if (spec.type === 'slider') return {id:spec.id,start(){emit(observation(spec.id,spec.initial,{at:clock()}));},set(value){emit(observation(spec.id,value,{at:clock()}));},invalid(){emit(observation(spec.id,NaN,{at:clock(),reason:'Sensor reports invalid'}));},missing(){emit(observation(spec.id,null,{at:clock(),reason:'No observation'}));}};
  if (spec.type === 'fixture') {let index=0;return {id:spec.id,start(){index=0;emit(observation(spec.id,spec.samples[0],{at:clock()}));},next(){index=(index+1)%spec.samples.length;emit(observation(spec.id,spec.samples[index],{at:clock()}));},invalid(){emit(observation(spec.id,NaN,{at:clock(),reason:'Fixture invalid'}));},missing(){emit(observation(spec.id,null,{at:clock(),reason:'Fixture missing'}));}};}
  throw new Error('Unknown source adapter');
}
function eventFrom(reading,config) {
  if (!reading || reading.id!==OBSERVATION_ID || reading.unit!==UNIT || reading.simulated!==true || !validTime(reading.observedAt) || !sourceKnown(config,reading.sourceId)) return null;
  const valid=reading.valid===true && isHeel(reading.value);
  return Object.freeze({id:OBSERVATION_ID,unit:UNIT,value:valid?reading.value:null,observedAt:reading.observedAt,sourceId:reading.sourceId,valid,simulated:true,...(!valid?{reason:typeof reading.reason==='string'&&reading.reason?reading.reason:'Invalid or missing observation'}:{})});
}
export function createRecorder(config,clock=()=>new Date()) { const events=[]; return Object.freeze({record(reading){const event=eventFrom(reading,config);if(event)events.push(event);},clear(){events.length=0;},get size(){return events.length;},export(){return {format:RECORDING_FORMAT,version:RECORDING_VERSION,createdAt:clock().toISOString(),observation:{id:OBSERVATION_ID,unit:UNIT},events:[...events]};}}); }
/** Parses untrusted JSON; bad event values become unavailable events, never displayable numbers. */
export function parseRecording(input,config) {
  let data;try{data=typeof input==='string'?JSON.parse(input):input;}catch{throw new Error('Recording is not valid JSON');}
  if (!data || data.format!==RECORDING_FORMAT || data.version!==RECORDING_VERSION || data.observation?.id!==config.observation.id || data.observation?.unit!==config.observation.unit || !Array.isArray(data.events) || !data.events.length) throw new Error('Unsupported or malformed recording');
  const events=data.events.map((event,index)=>{if(!event || !validTime(event.observedAt) || typeof event.sourceId!=='string' || !sourceKnown(config,event.sourceId) || event.id!==OBSERVATION_ID || event.unit!==UNIT || event.simulated!==true) throw new Error(`Malformed recording event ${index+1}`);return eventFrom(event,config);});
  for(let index=1;index<events.length;index++) if(Date.parse(events[index].observedAt)<Date.parse(events[index-1].observedAt)) throw new Error('Recording events are not chronological');
  const first=Date.parse(events[0].observedAt); return Object.freeze({events:Object.freeze(events),durationMs:Math.max(0,...events.map(event=>Date.parse(event.observedAt)-first))});
}
export function createReplaySource(spec,recording,emit,now=()=>Date.now()) {
  if (spec.type!=='replay') throw new Error('Not a replay source'); const events=recording.events,first=Date.parse(events[0].observedAt); let position=0,speed=1,playing=false,startedAt=now(),emitted=-1;
  const clamp=value=>Math.max(0,Math.min(recording.durationMs,value)); const current=()=>playing?clamp(position+(now()-startedAt)*speed):position;
  const send=index=>{const event=events[index];emit(Object.freeze({...event,replay:{sourceId:spec.id,effectiveTimeMs:Math.max(0,Date.parse(event.observedAt)-first)}}));emitted=index;};
  const through=(value,all=false)=>{let last=-1;for(let i=0;i<events.length;i++)if(Date.parse(events[i].observedAt)-first<=value)last=i;if(last<0||last===emitted)return;if(all){for(let i=emitted+1;i<=last;i++)send(i);}else send(last);};
  const freeze=()=>{position=current();playing=false;};
  return {id:spec.id,start(){startedAt=now();emitted=-1;through(position);},play(){if(!playing){startedAt=now();playing=true;}},pause(){if(playing)freeze();},restart(){playing=false;position=0;startedAt=now();emitted=-1;through(0);},seek(value){position=clamp(value);startedAt=now();emitted=-1;through(position);},setSpeed(value){if(![1,2,4].includes(value))throw new Error('Unsupported playback speed');if(playing){position=current();startedAt=now();}speed=value;},tick(){if(!playing)return;const value=current();through(value,true);if(value>=recording.durationMs)freeze();},get position(){return current();},get speed(){return speed;},get playing(){return playing;},get duration(){return recording.durationMs;}};
}
export function createBus(config,sink,now=()=>Date.now(),onAccepted=()=>{}) {let activeSource=config.defaultSource,latest=null;const dispatch=reading=>{const delivery=reading?.replay?.sourceId||reading?.sourceId;if(delivery!==activeSource)return;latest=reading;const state=acceptable(reading,config,now());sink(reading,state);onAccepted(reading);};return {dispatch,select(id){if(!sourceKnown(config,id))throw new Error('Unknown source');activeSource=id;latest=null;sink(null,{ok:false,reason:'Awaiting source observation'});},refresh(){sink(latest,acceptable(latest,config,now()));},get activeSource(){return activeSource;}};}
