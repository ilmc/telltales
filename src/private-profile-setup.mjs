import{listTemplateCompatibility}from'./sensor-groups.mjs';
import{composeLocalProfile,parseLocalProfile,MAX_PROFILE_BYTES}from'./private-profile-contract.mjs';
import{mountSensorGroupHud}from'./sensor-groups-demo.mjs';
const sessionId='private-profile-session';

export function mountPrivateProfileSetup({community,root=document.body}){
  root.replaceChildren();
  const main=document.createElement('main');main.className='sensor-setup';
  const title=document.createElement('h1');title.textContent='Private boat profile setup';
  const note=document.createElement('p');note.textContent='Choose a local JSON profile. It stays in this tab’s memory, is not uploaded or stored, and disappears on reload. No hardware feed is connected. NOT FOR NAVIGATION.';
  const label=document.createElement('label');label.textContent='Choose local boat profile ';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Choose local boat profile');label.append(input);
  const message=document.createElement('p');message.setAttribute('role','status');
  const list=document.createElement('section');list.className='template-list';
  main.append(title,note,label,message,list);root.append(main);
  let active=null;
  input.addEventListener('change',async()=>{
    list.replaceChildren();active=null;message.textContent='';
    const file=input.files?.[0];
    if(!file)return;
    if(file.size>MAX_PROFILE_BYTES){message.textContent='Profile exceeds 64 KiB limit.';return}
    try{
      const profile=parseLocalProfile(await file.text());
      active=composeLocalProfile(profile,community);
      message.textContent='Local profile validated. No readings are connected.';
      for(const match of listTemplateCompatibility(active,profile.sensorGroup.id)){
        const template=active.templates.find(x=>x.id===match.templateId);
        const card=document.createElement('article');card.className='card template-card '+match.status;card.dataset.template=template.id;
        const heading=document.createElement('h2');heading.textContent=template.title;
        const status=document.createElement('p');status.className='compatibility';status.textContent=match.status.toUpperCase();
        const missing=Object.values(match.inputs).filter(i=>i.status!=='available').map(i=>i.title||i.id);
        if(missing.length)status.textContent+=' · missing: '+missing.join(', ');
        const button=document.createElement('button');button.textContent='Use this display';button.disabled=match.status==='incompatible';
        button.addEventListener('click',()=>{
          if(!active)return;
          // Preserve profile only in this JS closure; do not navigate or serialize
          // any private data in the URL, storage, or BroadcastChannel.
          mountSensorGroupHud({catalog:active,sessionId,templateId:template.id,profileOnly:true,root});
        });
        card.append(heading,status,button);list.append(card);
      }
    }catch(error){active=null;message.textContent='Invalid local boat profile. Check its format, sensors, references and calibration.'}
  });
  return{input,main};
}
