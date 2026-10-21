// Signal K adapter.  Telltales values stay at the observation boundary in kn/m/deg.
const KNOT=1852/3600, rad=x=>x*Math.PI/180, deg=x=>x*180/Math.PI;
export const SIGNALK_PATHS=Object.freeze({
  'vessel.speedOverGround':'navigation.speedOverGround',
  'vessel.speedThroughWater':'navigation.speedThroughWater',
  'environment.wind.apparentSpeed':'environment.wind.speedApparent',
  'environment.wind.apparentAngle':'environment.wind.angleApparent',
  'vessel.heel':'navigation.attitude.roll',
  // Signal K has belowSurface/belowTransducer/belowKeel, none means unknown reference.
  'environment.depth':'environment.depth.telltalesUnknownReference'
});
const REVERSE=Object.fromEntries(Object.entries(SIGNALK_PATHS).map(([a,b])=>[b,a]));
const finite=x=>typeof x==='number'&&Number.isFinite(x), stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const key=id=>id.replaceAll('.','_');
export function toSignalKValue(observation){
  if(!observation||!SIGNALK_PATHS[observation.id]||!stamp(observation.observedAt))return null;
  let value=observation.value;
  if(observation.valid){
    if(!finite(value))return null;
    if(observation.unit==='kn')value*=KNOT;
    if(observation.unit==='deg')value=rad(value);
  } else value=null;
  return {path:SIGNALK_PATHS[observation.id],value};
}
export function observationToDelta(observation){
  let value=toSignalKValue(observation);if(!value)return null;
  let meta={id:observation.id,unit:observation.unit,sourceId:observation.sourceId,valid:observation.valid,simulated:observation.simulated,observedAt:observation.observedAt,reason:observation.reason||null,replay:observation.replay||null,provenance:observation.provenance||null};
  return {context:'vessels.self',updates:[{timestamp:observation.observedAt,source:{label:`telltales:${observation.sourceId}`,type:'other'},values:[value,{path:`telltales.observationMeta.${key(observation.id)}`,value:meta}]}]};
}
function fromValue(path,value){let id=REVERSE[path];if(!id||!finite(value))return null;if(id.includes('speed'))value/=KNOT;if(id.endsWith('Angle')||id==='vessel.heel')value=deg(value);return{id,value};}
export function deltaToObservations(delta,{now=new Date()}={}){
  if(!delta||!Array.isArray(delta.updates))return[];let out=[];
  for(const update of delta.updates){let at=stamp(update.timestamp)?update.timestamp:now.toISOString(), meta=new Map,values=[];
    for(const v of update.values||[]){let m=/^telltales\.observationMeta\.(.+)$/.exec(v?.path||'');if(m&&v.value?.id)meta.set(v.value.id,v.value);else values.push(v)}
    for(const v of values){let id=REVERSE[v?.path],parsed=fromValue(v?.path,v?.value),m=meta.get(id);if(!parsed&&!(id&&m?.valid===false))continue;if(!parsed)parsed={id,value:null};let sourceId=m?.sourceId||update.source?.label||'signalk-external';
      // An external Signal K producer is not claimed to be simulated.
      out.push({id:parsed.id,unit:m?.unit|| (parsed.id.includes('speed')?'kn':parsed.id==='environment.depth'?'m':'deg'),value:m?.valid===false?null:parsed.value,observedAt:m?.observedAt||at,sourceId,valid:m?.valid!==false,simulated:m?.simulated===true,replay:m?.replay||undefined,provenance:m?.provenance||{kind:'signalk',source:update.source?.label||'unknown'},...(m?.valid===false?{reason:m.reason||'Signal K source reports unavailable'}:{})});
    }
  } return out;
}
export function createSignalKSubscriber({url,onObservation,onState,WebSocketImpl=globalThis.WebSocket,reconnectMs=1000}){
  let ws,closed=false,timer;const state=x=>onState?.(x),subscription={context:'vessels.self',subscribe:[...Object.values(SIGNALK_PATHS),...Object.keys(SIGNALK_PATHS).map(id=>`telltales.observationMeta.${key(id)}`)].map(path=>({path,period:100}))};const connect=()=>{if(closed)return;try{state({connected:false,reason:'Connecting to Signal K'});ws=new WebSocketImpl(url)}catch(e){state({connected:false,reason:`Signal K unavailable: ${e.message}`});timer=setTimeout(connect,reconnectMs);return}ws.onopen=()=>{ws.send(JSON.stringify(subscription));state({connected:true})};ws.onmessage=e=>{try{for(const r of deltaToObservations(JSON.parse(e.data)))onObservation(r)}catch{state({connected:false,reason:'Malformed Signal K delta rejected'})}};ws.onerror=()=>state({connected:false,reason:'Signal K connection error'});ws.onclose=()=>{state({connected:false,reason:'Signal K disconnected'});if(!closed)timer=setTimeout(connect,reconnectMs)}};connect();return{close(){closed=true;clearTimeout(timer);ws?.close()}};
}
