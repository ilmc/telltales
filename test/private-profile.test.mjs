import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{composeLocalProfile,parseLocalProfile,MAX_PROFILE_BYTES}from'../src/private-profile-setup.mjs';
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
