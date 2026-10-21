import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateConfiguration,observation,acceptable,createSource,createBus} from '../src/core.mjs';
const config = validateConfiguration(JSON.parse(readFileSync(new URL('../config.json',import.meta.url),'utf8')));
const at = new Date('2026-10-21T12:00:00Z');
const now = at.getTime();
test('declarative source and renderer wiring validates; bad wiring is rejected',()=>{
  assert.equal(config.renderer.observation,config.observation.id);
  assert.throws(()=>validateConfiguration({...config,renderer:{...config.renderer,observation:'other'}}));
  assert.throws(()=>validateConfiguration({...config,sources:[...config.sources,config.sources[0]]}));
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
