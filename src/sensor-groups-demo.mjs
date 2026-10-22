import {createSensorSession} from './sensor-groups.mjs';
const catalog=await(await fetch('./examples/synthetic-sensor-groups.json')).json();
const group=document.getElementById('group');
const template=document.getElementById('template');
let clock=Date.now(),session;
const render=values=>{
 for(const id of ['sog','remoteWind','shoreWind']){
  const el=document.querySelector(`[data-binding="${id}"]`);
  const value=values[id],reading=el.querySelector('.reading'),meta=el.querySelector('.meta');
  el.hidden=!value;
  if(!value)continue;
  reading.innerHTML=value.ok?`${value.value.toFixed(1)}<small> ${value.unit}</small>`:'—';
  meta.textContent=value.ok?`${value.providerLabel} · ${value.frame} · ${value.simulated?'SIMULATED':'LIVE'}${value.fallback?' · FALLBACK':''}`:`UNAVAILABLE · ${value.frame} · ${value.reason}`;
  meta.className=`meta ${value.ok?'status':'unavailable'}`;
 }
};
function setup(){
 session=createSensorSession(catalog,'guest',({values})=>render(values),()=>clock);
 session.selectGroup(group.value);
 template.textContent=session.template;
}
group.addEventListener('change',()=>session.selectGroup(group.value));
document.getElementById('send').addEventListener('click',()=>{
 clock=Date.now();
 for(const [providerId,channelId,observation,unit,frame,value] of [
 ['phone','sog','vessel.speedOverGround','kn','own-vessel',5.6],
 ['guest-mast','apparent','environment.wind.apparentSpeed','kn','other-vessel',14.8],
 ['shore','wind','environment.wind.speed','kn','fixed-site',9.2]
 ])session.dispatch({providerId,channelId,observation,unit,frame,value,valid:true,simulated:true,observedAt:new Date(clock).toISOString()});
});
document.getElementById('invalidate').addEventListener('click',()=>{
 clock+=31000; session.refresh();
});
setup();
