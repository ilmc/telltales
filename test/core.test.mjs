import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateConfiguration,observation,acceptable,createSource,createBus,createRecorder,parseRecording,createReplaySource,RECORDING_FORMAT,RECORDING_VERSION} from '../src/core.mjs';
const config = validateConfiguration(JSON.parse(readFileSync(new URL('../config.json',import.meta.url),'utf8')));
const at = new Date('2026-10-21T12:00:00Z');
const now = at.getTime();
test('declarative source and renderer wiring validates; bad wiring is rejected',()=>{
  assert.equal(config.renderer.observation,config.observation.id);
  assert.throws(()=>validateConfiguration({...config,renderer:{...config.renderer,observation:'other'}}));
  assert.throws(()=>validateConfiguration({...config,sources:[...config.sources,config.sources[0]]}));
  assert.throws(()=>validateConfiguration({...config,sources:[config.sources[0],{...config.sources[0],id:'second-slider'}]}));
  assert.throws(()=>validateConfiguration({...config,sources:[{...config.sources[1],id:' '},config.sources[0]]}));
  const changed={...config,sources:[{...config.sources[0],id:'helm-slider',initial:12},{...config.sources[1],id:'recorded-fixture',samples:[-12,0,73]}],defaultSource:'recorded-fixture'};
  assert.equal(validateConfiguration(changed).defaultSource,'recorded-fixture');
});
test('typed simulated observation preserves identity units time source and validity',()=>{
  const reading=observation('virtual-heel',-90,{at});
  assert.deepEqual({id:reading.id,unit:reading.unit,value:reading.value,sourceId:reading.sourceId,observedAt:reading.observedAt,valid:reading.valid,simulated:reading.simulated},
    {id:'vessel.heel',unit:'deg',value:-90,sourceId:'virtual-heel',observedAt:at.toISOString(),valid:true,simulated:true});
  assert.equal(acceptable(reading,config,now).ok,true);
  assert.equal(acceptable(observation('virtual-heel',90,{at}),config,now).ok,true);
});
test('invalid, absent, out of range, stale and future observations fail closed',()=>{
  for(const v of [null,NaN,Infinity,-91,91,'10'])
    assert.equal(acceptable(observation('virtual-heel',v,{at}),config,now).ok,false);
  assert.equal(acceptable(observation('virtual-heel',20,{at}),config,now+31000).ok,false);
  assert.equal(acceptable(observation('virtual-heel',20,{at}),config,now-2000).ok,false);
  assert.equal(acceptable({...observation('virtual-heel',20,{at}),unit:'rad'},config,now).ok,false);
  assert.equal(acceptable(observation('unregistered',20,{at}),config,now).ok,false);
});
test('slider and fixture substitute through identical observation/renderer boundary',()=>{
  const presentations=[];
  const bus=createBus(config,(reading,state)=>presentations.push({reading,state}),()=>now);
  const slider=createSource(config.sources[0],bus.dispatch,()=>at);
  const fixture=createSource(config.sources[1],bus.dispatch,()=>at);
  slider.start();assert.equal(presentations.at(-1).state.value,0);
  slider.set(35);assert.equal(presentations.at(-1).state.value,35);
  bus.select(fixture.id);fixture.start();assert.equal(presentations.at(-1).state.value,-25);
  fixture.next();assert.equal(presentations.at(-1).state.value,0);
  slider.set(72);assert.equal(presentations.at(-1).state.value,0,'inactive source cannot overwrite reading');
  fixture.invalid();assert.equal(presentations.at(-1).state.ok,false);
  fixture.missing();assert.equal(presentations.at(-1).reading.value,null);
  bus.select(slider.id);slider.set(-12);assert.equal(presentations.at(-1).state.value,-12);
});
test('refresh invalidates elapsed observation without a new emission',()=>{
  let nowMs=now;let state;
  const bus=createBus(config,(_reading,next)=>{state=next},()=>nowMs);
  bus.dispatch(observation('virtual-heel',15,{at}));
  assert.equal(state.ok,true);nowMs+=31000;bus.refresh();assert.equal(state.ok,false);
});
test('recording round trip preserves values, invalid/missing events, time, units and source provenance',()=>{
  const recorder=createRecorder(config,()=>at);
  recorder.record(observation('virtual-heel',12,{at}));
  recorder.record(observation('virtual-heel',NaN,{at:new Date(now+1000),reason:'Sensor reports invalid'}));
  recorder.record(observation('virtual-heel',null,{at:new Date(now+2000),reason:'No observation'}));
  const exported=recorder.export(); const parsed=parseRecording(JSON.stringify(exported),config);
  assert.equal(exported.format,RECORDING_FORMAT);assert.equal(exported.version,RECORDING_VERSION);assert.equal(parsed.events.length,3);
  assert.deepEqual(parsed.events.map(e=>[e.value,e.valid,e.unit,e.sourceId,e.observedAt]),[[12,true,'deg','virtual-heel',at.toISOString()],[null,false,'deg','virtual-heel',new Date(now+1000).toISOString()],[null,false,'deg','virtual-heel',new Date(now+2000).toISOString()]]);
});
test('recordings reject bad envelopes and safely invalidate out-of-range event values',()=>{
  assert.throws(()=>parseRecording('{bad',config));
  assert.throws(()=>parseRecording({format:RECORDING_FORMAT,version:99,observation:{id:'vessel.heel',unit:'deg'},events:[]},config));
  assert.throws(()=>parseRecording({format:RECORDING_FORMAT,version:1,observation:{id:'vessel.heel',unit:'deg'},events:[observation('virtual-heel',1,{at:new Date(now+1000)}),observation('virtual-heel',2,{at})]},config));
  const parsed=parseRecording({format:RECORDING_FORMAT,version:1,observation:{id:'vessel.heel',unit:'deg'},events:[{...observation('virtual-heel',20,{at}),value:500,valid:true}]},config);
  assert.equal(parsed.events[0].valid,false);assert.equal(parsed.events[0].value,null);
});
test('replay is deterministic, retains original time/source, supports seek restart pause and speed',()=>{
  const recording=parseRecording({format:RECORDING_FORMAT,version:1,observation:{id:'vessel.heel',unit:'deg'},events:[observation('virtual-heel',10,{at}),observation('virtual-heel',NaN,{at:new Date(now+1000),reason:'bad'}),observation('virtual-heel',-20,{at:new Date(now+3000)})]},config);
  let wall=0;const seen=[];const replay=createReplaySource(config.sources.find(s=>s.type==='replay'),recording,reading=>seen.push(reading),()=>wall);
  replay.start();assert.equal(seen.at(-1).value,10);assert.equal(seen.at(-1).observedAt,at.toISOString());
  replay.play();wall=500;replay.tick();assert.equal(seen.length,1);replay.setSpeed(2);wall=750;replay.tick();assert.equal(seen.at(-1).valid,false);
  replay.pause();const paused=replay.position;wall=100000;replay.tick();assert.equal(replay.position,paused);assert.equal(acceptable(seen.at(-1),config,wall).ok,false,'invalid remains unavailable');
  replay.seek(3000);assert.equal(seen.at(-1).value,-20);assert.equal(seen.at(-1).replay.effectiveTimeMs,3000);assert.equal(acceptable(seen.at(-1),config,999999999).ok,true,'replay does not go stale by wall clock');
  replay.restart();assert.equal(seen.at(-1).value,10);assert.equal(replay.position,0);
});
test('replay delivery is isolated from its original live source and does not overwrite a switched source',()=>{
  const recording=parseRecording({format:RECORDING_FORMAT,version:1,observation:{id:'vessel.heel',unit:'deg'},events:[observation('virtual-heel',20,{at})]},config);
  const seen=[];const bus=createBus(config,(reading)=>seen.push(reading),()=>now);const replay=createReplaySource(config.sources.find(s=>s.type==='replay'),recording,bus.dispatch,()=>0);
  bus.select('recording-replay');replay.start();assert.equal(seen.at(-1).value,20);bus.select('virtual-heel');replay.restart();assert.equal(seen.at(-1),null);bus.select('recording-replay');replay.start();assert.equal(seen.at(-1).value,20);
});
