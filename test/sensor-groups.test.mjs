import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSensorCatalog,createSensorSession} from '../src/sensor-groups.mjs';
const fixture=JSON.parse(readFileSync(new URL('../examples/synthetic-sensor-groups.json',import.meta.url),'utf8'));
const clone=()=>structuredClone(fixture);
const now=Date.parse('2026-10-22T12:00:00Z');
const sample=(providerId,channelId,observation,unit,frame,value,delta=0)=>({
 providerId,channelId,observation,unit,frame,value,valid:true,simulated:true,
 observedAt:new Date(now+delta).toISOString()
});
test('validates three providers and independent sessions',()=>{
 assert.equal(validateSensorCatalog(fixture).providers.length,3);
 assert.equal(fixture.sessions[0].template,fixture.sessions[1].template);
 for(const key of ['providers','groups','sessions']){
  const bad=clone();bad[key].push(structuredClone(bad[key][0]));
  assert.throws(()=>validateSensorCatalog(bad),/Duplicate/);
 }
});
test('rejects missing channel and mismatched frame or unit',()=>{
 for(const field of ['channel','provider']){
  const bad=clone();bad.groups[0].bindings[0].candidates[0][field]='unknown';
  assert.throws(()=>validateSensorCatalog(bad),/Missing/);
 }
 for(const field of ['frame','unit','observation']){
  const bad=clone();bad.groups[0].bindings[0][field]='wrong';
  assert.throws(()=>validateSensorCatalog(bad),/Incompatible|Invalid group binding/);
 }
 const bad=clone();bad.providers[1].channels[0].frame='own-vessel';
 assert.throws(()=>validateSensorCatalog(bad),/Invalid channel semantics/);
});
test('remote wind never becomes own vessel apparent wind',()=>{
 const bad=clone();bad.groups[0].bindings.push({id:'false-wind',observation:'environment.wind.apparentSpeed',unit:'kn',frame:'own-vessel',candidates:[{provider:'guest-mast',channel:'apparent'}]});
 assert.throws(()=>validateSensorCatalog(bad),/Incompatible/);
});
test('freshness, loss, conflict precedence and explicit fallback are observable',()=>{
 const cat=clone();
 cat.providers.push({id:'phone-spare',label:'Spare phone',context:'phone',channels:[{id:'sog',observation:'vessel.speedOverGround',unit:'kn',frame:'own-vessel'}]});
 cat.groups[0].bindings[0].candidates.push({provider:'phone-spare',channel:'sog'});
 const sess=createSensorSession(cat,'guest',()=>{},()=>now);
 assert.equal(sess.snapshot().sog.ok,false);
 assert.equal(sess.dispatch(sample('phone-spare','sog','vessel.speedOverGround','kn','own-vessel',4)),true);
 assert.equal(sess.snapshot().sog.fallback,true);
 assert.equal(sess.dispatch(sample('phone','sog','vessel.speedOverGround','kn','own-vessel',5)),true);
 assert.equal(sess.snapshot().sog.value,5);
 assert.equal(sess.snapshot().sog.fallback,false);
 assert.equal(sess.dispatch(sample('phone','sog','vessel.speedOverGround','kn','other-vessel',9)),false);
 assert.equal(sess.snapshot().sog.value,5);
 assert.equal(sess.dispatch(sample('phone','sog','vessel.speedOverGround','kn','own-vessel',6,-31000)),true);
 assert.equal(sess.snapshot().sog.value,4);
 assert.equal(sess.snapshot().sog.fallback,true);
 assert.equal(sess.dispatch({...sample('phone-spare','sog','vessel.speedOverGround','kn','own-vessel',4),valid:false}),true);
 assert.equal(sess.snapshot().sog.ok,false);
});
test('group switching retains template and clears context history',()=>{
 const sess=createSensorSession(fixture,'guest',()=>{},()=>now);
 sess.dispatch(sample('guest-mast','apparent','environment.wind.apparentSpeed','kn','other-vessel',13));
 assert.equal(sess.snapshot().remoteWind.providerLabel,'Other boat masthead (synthetic)');
 sess.dispatch(sample('shore','wind','environment.wind.speed','kn','fixed-site',8));
 assert.equal(sess.snapshot().shoreWind.frame,'fixed-site');
 const template=sess.template;
 sess.selectGroup('shore-only');
 assert.equal(sess.template,template);
 assert.equal(sess.snapshot().shoreWind.ok,false);
 assert.equal(sess.snapshot().remoteWind,undefined);
 assert.throws(()=>sess.selectGroup('missing'),/Unknown/);
});
test('home and guest sessions do not share observations',()=>{
 const guest=createSensorSession(fixture,'guest',()=>{},()=>now);
 const home=createSensorSession(fixture,'home',()=>{},()=>now);
 guest.dispatch(sample('phone','sog','vessel.speedOverGround','kn','own-vessel',5));
 assert.equal(guest.snapshot().sog.ok,true);
 assert.equal(home.snapshot().sog.ok,false);
});
