import {createSensorSession} from './sensor-groups.mjs';

const samples=[['phone','sog','vessel.speedOverGround','kn','own-vessel',5.6],['guest-mast','apparent','environment.wind.apparentSpeed','kn','other-vessel',14.8],['shore','wind','environment.wind.speed','kn','fixed-site',9.2]];

export function mountSensorGroupHud({catalog,configuration,sessionId='guest',requestedGroup,root=document.body}) {
 const sessionConfig=catalog.sessions.find(x=>x.id===sessionId);
 if(!sessionConfig)throw Error('Unknown sensor-group session');
 const template=configuration.templates.find(x=>x.id===sessionConfig.template),widgets=new Map(configuration.widgets.map(x=>[x.id,x]));
 if(!template||!template.widgets.every(id=>widgets.get(id)?.widget==='sensor-reading'))throw Error('Sensor-group template must contain configured sensor-reading widgets');
 let clock=Date.now(),session;
 root.innerHTML=`<style>.sensor-group-hud{min-height:100vh;padding:clamp(12px,2vw,30px);color:#f3f6fa}.sensor-group-hud header{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.sensor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:28px 0}.sensor-card{min-height:245px;padding:22px;border:1px solid #476072;background:#122639;border-radius:18px}.sensor-card h2{font-size:clamp(17px,2vw,24px);margin:0}.sensor-card .reading{font-weight:700;font-variant-numeric:tabular-nums;font-size:clamp(38px,6vw,88px);margin:18px 0 6px}.sensor-card .reading small{font-size:.28em}.sensor-group-hud footer{font-size:14px;color:#bbcad8}.sensor-group-hud .banner{font-size:14px;color:#ffe1a9}@media(max-width:750px){.sensor-grid{grid-template-columns:1fr}.sensor-card{min-height:170px}.sensor-card .reading{font-size:44px;margin:8px 0}}</style><main class="sensor-group-hud"><header><div><h1>Multi-origin observations</h1><p>Synthetic-only Telltales sensor-group HUD · template <strong id="template"></strong></p></div><div class="controls"><label for="group">Sensor group</label><select id="group">${catalog.groups.map(x=>`<option value="${x.id}">${x.id}</option>`).join('')}</select><button id="send">Send synthetic readings</button><button id="invalidate">Lose feeds</button></div></header><p class="banner">NOT FOR NAVIGATION — no live phone, vessel or shore sensors are connected. Other-vessel and fixed-site wind are never own-vessel apparent wind.</p><section class="sensor-grid">${template.widgets.map(id=>{const w=widgets.get(id);return `<article class="sensor-card" data-binding="${w.props.binding}" data-slot="${template.layout.slots[id]||''}"><h2>${w.props.title}</h2><div class="reading">—</div><p class="meta unavailable">Awaiting synthetic data</p></article>`}).join('')}</section><footer>Provider, channel, units, frame and fallback are shown for each configured template widget. Group changes clear prior observations.</footer></main>`;
 const group=root.querySelector('#group');
 const render=values=>{for(const [binding,value] of Object.entries(values)){const el=root.querySelector(`[data-binding="${binding}"]`);if(!el)continue;el.hidden=false;const reading=el.querySelector('.reading'),meta=el.querySelector('.meta');reading.innerHTML=value.ok?`${value.value.toFixed(1)}<small> ${value.unit}</small>`:'—';meta.textContent=value.ok?`${value.providerLabel} / ${value.channelId} · ${value.frame} · ${value.simulated?'SYNTHETIC':'LIVE'}${value.fallback?' · FALLBACK':''}`:`UNAVAILABLE · ${value.frame} · ${value.reason}`;meta.className=`meta ${value.ok?'status good':'unavailable'}`;}for(const el of root.querySelectorAll('[data-binding]'))if(!(el.dataset.binding in values))el.hidden=true;};
 session=createSensorSession(catalog,sessionId,({values})=>render(values),()=>clock);
 root.querySelector('#template').textContent=template.id;
 if(requestedGroup){if(!catalog.groups.some(x=>x.id===requestedGroup))throw Error('Unknown requested sensor group');group.value=requestedGroup;}
 session.selectGroup(group.value);
 group.addEventListener('change',()=>session.selectGroup(group.value));
 root.querySelector('#send').addEventListener('click',()=>{clock=Date.now();for(const [providerId,channelId,observation,unit,frame,value] of samples)session.dispatch({providerId,channelId,observation,unit,frame,value,valid:true,simulated:true,observedAt:new Date(clock).toISOString()});});
 root.querySelector('#invalidate').addEventListener('click',()=>{clock+=31000;session.refresh();});
 return session;
}

if(document.body.dataset.sensorGroupsDemo==='true'){
 const [catalog,configuration]=await Promise.all([fetch('./examples/synthetic-sensor-groups.json').then(x=>x.json()),fetch('./config.json').then(x=>x.json())]);
 mountSensorGroupHud({catalog,configuration,requestedGroup:new URLSearchParams(location.search).get('sensorGroup')});
}
