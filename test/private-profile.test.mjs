import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{composeLocalProfile,parseLocalProfile,MAX_PROFILE_BYTES}from'../src/private-profile-contract.mjs';
const profile=JSON.parse(readFileSync(new URL('../examples/local-boat-profile.example.json',import.meta.url)));
const community=JSON.parse(readFileSync(new URL('../examples/synthetic-sensor-groups.json',import.meta.url)));
test('private profile replaces fixture inventory without mutating community fixtures',()=>{
 const c=composeLocalProfile(profile,community);
 assert.equal(c.groups.length,1);
 assert.deepEqual(c.providers.map(x=>x.id),['local-instruments']);
 assert.equal(community.providers.some(x=>x.id==='boat'),true);
 assert.equal(c.sessions.length,1);
});
test('private profiles fail closed for invalid datum, missing channels and excessive size',()=>{
 assert.throws(()=>parseLocalProfile('{'),/Invalid JSON/);
 assert.throws(()=>parseLocalProfile('x'.repeat(MAX_PROFILE_BYTES+1)),/too large/);
 const bad=structuredClone(profile);bad.sensorGroup.bindings[0].candidates[0].channel='wrong';
 assert.throws(()=>composeLocalProfile(bad,community),/Missing provider\/channel/);
 const wrong=structuredClone(profile);wrong.providers[0].channels[1].installation.depthDatum='invented';
 assert.throws(()=>composeLocalProfile(wrong,community),/Depth/);
});


test('two independently installed boats can select the same semantic display',()=>{
  const second=structuredClone(profile);
  second.id='second-local-boat';
  second.providers[0].id='other-inclinometer';
  second.providers[0].channels[0].id='tilt';
  second.providers[0].channels[0].installation.calibration='unknown';
  second.sensorGroup.id='second-sensors';
  second.sensorGroup.bindings[0].candidates[0]={provider:'other-inclinometer',channel:'tilt'};
  second.sensorGroup.bindings=second.sensorGroup.bindings.slice(0,1);
  second.providers[0].channels=second.providers[0].channels.slice(0,1);
  const a=composeLocalProfile(profile,community),b=composeLocalProfile(second,community);
  assert.equal(a.templates[0].id,b.templates[0].id);
  assert.notEqual(a.providers[0].id,b.providers[0].id);
  assert.deepEqual(a.groups[0].bindings[0].candidates,[{provider:'local-instruments',channel:'heel-inclinometer'}]);
  assert.deepEqual(b.groups[0].bindings[0].candidates,[{provider:'other-inclinometer',channel:'tilt'}]);
  assert.equal(community.providers.some(x=>x.id==='other-inclinometer'),false);
});
test('private profile identifiers never silently bind bundled fixture channels',()=>{
 const collision=structuredClone(profile);
 collision.providers[0].id='boat';
 collision.sensorGroup.bindings.forEach(b=>b.candidates.forEach(c=>c.provider='boat'));
 const c=composeLocalProfile(collision,community);
 assert.deepEqual(c.providers.map(p=>p.id),['boat']);
 assert.deepEqual(c.groups.map(g=>g.id),['example-local-sensors']);
 assert.equal(c.providers[0].channels.some(x=>x.id==='sog'),false);
});
