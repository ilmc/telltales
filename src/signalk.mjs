// Signal K adapter.  Telltales values stay at the observation boundary in kn/m/deg.
const KNOT=1852/3600, rad=x=>x*Math.PI/180, deg=x=>x*180/Math.PI;
// Explicitly typed so conversion never depends on a presentation-facing ID name.
export const SIGNALK_OBSERVATIONS=Object.freeze({
  'vessel.speedOverGround':{path:'navigation.speedOverGround',unit:'kn',toSignalK:x=>x*KNOT,fromSignalK:x=>x/KNOT},
  'vessel.speedThroughWater':{path:'navigation.speedThroughWater',unit:'kn',toSignalK:x=>x*KNOT,fromSignalK:x=>x/KNOT},
  'environment.wind.apparentSpeed':{path:'environment.wind.speedApparent',unit:'kn',toSignalK:x=>x*KNOT,fromSignalK:x=>x/KNOT},
  'environment.wind.apparentAngle':{path:'environment.wind.angleApparent',unit:'deg',toSignalK:rad,fromSignalK:deg},
  'vessel.heel':{path:'navigation.attitude.roll',unit:'deg',toSignalK:rad,fromSignalK:deg},
  // Signal K has belowSurface/belowTransducer/belowKeel, none means unknown reference.
  'environment.depth':{path:'environment.depth.telltalesUnknownReference',unit:'m',toSignalK:x=>x,fromSignalK:x=>x}
});
export const SIGNALK_PATHS=Object.freeze(Object.fromEntries(Object.entries(SIGNALK_OBSERVATIONS).map(([id,x])=>[id,x.path])));
const REVERSE=Object.fromEntries(Object.entries(SIGNALK_OBSERVATIONS).map(([id,x])=>[x.path,{id,...x}]));
const finite=x=>typeof x==='number'&&Number.isFinite(x), stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const key=id=>id.replaceAll('.','_');
export function toSignalKValue(observation){
  let mapped=SIGNALK_OBSERVATIONS[observation?.id];if(!observation||!mapped||observation.unit!==mapped.unit||!stamp(observation.observedAt))return null;
  let value=observation.value;
  if(observation.valid){
    if(!finite(value))return null;
    value=mapped.toSignalK(value);
  } else value=null;
  return {path:mapped.path,value};
}
export function observationToDelta(observation){
  let value=toSignalKValue(observation);if(!value)return null;
  let meta={id:observation.id,unit:observation.unit,sourceId:observation.sourceId,valid:observation.valid,simulated:observation.simulated,observedAt:observation.observedAt,reason:observation.reason||null,replay:observation.replay||null,provenance:observation.provenance||null};
  return {context:'vessels.self',updates:[{timestamp:observation.observedAt,source:{label:`telltales:${observation.sourceId}`,type:'other'},values:[value,{path:`telltales.observationMeta.${key(observation.id)}`,value:meta}]}]};
}
function fromValue(path,value){let mapped=REVERSE[path];if(!mapped||!finite(value))return null;return{id:mapped.id,unit:mapped.unit,value:mapped.fromSignalK(value)};}
export function deltaToObservations(delta,{now=new Date()}={}){
  // Do not trust a broad or explicitly configured stream to isolate vessels.
  if(!delta||delta.context!=='vessels.self'||!Array.isArray(delta.updates))return[];let out=[];
  for(const update of delta.updates){let at=stamp(update.timestamp)?update.timestamp:now.toISOString(), meta=new Map,values=[];
    for(const v of update.values||[]){let m=/^telltales\.observationMeta\.(.+)$/.exec(v?.path||'');if(m&&v.value?.id)meta.set(v.value.id,v.value);else values.push(v)}
    const emitted=new Set,unavailable=(id,m)=>{let mapped=REVERSE[SIGNALK_PATHS[id]],sourceId=m?.sourceId||update.source?.label||'signalk-external';out.push({id,unit:m?.unit||mapped.unit,value:null,observedAt:m?.observedAt||at,sourceId,valid:false,simulated:m?.simulated===true,replay:m?.replay||undefined,provenance:m?.provenance||{kind:'signalk',source:update.source?.label||'unknown'},reason:m?.reason||'Signal K source reports unavailable'});emitted.add(id)};
    for(const v of values){let mapped=REVERSE[v?.path],id=mapped?.id,parsed=fromValue(v?.path,v?.value),m=meta.get(id);if(!id)continue;if(v?.value===null||m?.valid===false){unavailable(id,m);continue}if(!parsed)continue;let sourceId=m?.sourceId||update.source?.label||'signalk-external';
      // An external Signal K producer is not claimed to be simulated.
      out.push({id:parsed.id,unit:m?.unit||parsed.unit,value:parsed.value,observedAt:m?.observedAt||at,sourceId,valid:true,simulated:m?.simulated===true,replay:m?.replay||undefined,provenance:m?.provenance||{kind:'signalk',source:update.source?.label||'unknown'}});
    }for(const [id,m] of meta)if(m?.valid===false&&SIGNALK_PATHS[id]&&!emitted.has(id))unavailable(id,m);
  } return out;
}
export function createSignalKSubscriber({url,onObservation,onState,WebSocketImpl=globalThis.WebSocket,reconnectMs=1000}){
  let ws,closed=false,timer;
  const state=x=>onState?.(x),subscription={context:'vessels.self',subscribe:[...Object.values(SIGNALK_PATHS),...Object.keys(SIGNALK_PATHS).map(id=>`telltales.observationMeta.${key(id)}`)].map(path=>({path,period:100}))};
  const receive=delta=>{for(const observation of deltaToObservations(delta))onObservation(observation)};
  const connect=()=>{if(closed)return;try{state({connected:false,reason:'Connecting to Signal K'});ws=new WebSocketImpl(url)}catch(e){state({connected:false,reason:`Signal K unavailable: ${e.message}`});timer=setTimeout(connect,reconnectMs);return}ws.onopen=()=>{ws.send(JSON.stringify(subscription));state({connected:true})};ws.onmessage=e=>{try{receive(JSON.parse(e.data))}catch{state({connected:false,reason:'Malformed Signal K delta rejected'})}};ws.onerror=()=>state({connected:false,reason:'Signal K connection error'});ws.onclose=()=>{state({connected:false,reason:'Signal K disconnected'});if(!closed)timer=setTimeout(connect,reconnectMs)}};connect();return{close(){closed=true;clearTimeout(timer);ws?.close()}};
}
