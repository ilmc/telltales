import{validateBoatProfile}from'./boat-profile.mjs';
import{validateSensorCatalog}from'./sensor-groups.mjs';
export const MAX_PROFILE_BYTES=65536;
const sessionId='private-profile-session';
const templateId='heel-degrees';

// The user's profile replaces (never merges with) the synthetic installation
// inventory. Only community templates cross this boundary.
export function composeLocalProfile(profile,community){
  validateBoatProfile(profile);
  if(!community||!Array.isArray(community.templates)||!community.templates.length)throw Error('Missing community templates');
  if(community.templates.some(t=>t.id===sessionId))throw Error('Reserved template identifier');
  const catalog={
    version:2,
    providers:structuredClone(profile.providers),
    groups:[structuredClone(profile.sensorGroup)],
    templates:structuredClone(community.templates),
    sessions:[{id:sessionId,group:profile.sensorGroup.id,template:community.templates[0].id}]
  };
  validateSensorCatalog(catalog);
  return catalog;
}

export function parseLocalProfile(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_PROFILE_BYTES)throw Error('Profile file too large or unreadable');
  let value;
  try{value=JSON.parse(source)}catch{throw Error('Invalid JSON profile')}
  validateBoatProfile(value);
  return value;
}

