import {validateConfiguration,createBus,createSource,createRecorder,parseRecording,createReplaySource} from './core.mjs';
const $=id=>document.getElementById(id);
const clockText=ms=>`${(ms/1000).toFixed(1)}s`;
function render(reading,state) {
  $('reading').textContent=state.ok?`${state.value.toFixed(0)}°`:'—'; $('pointer').hidden=!state.ok;
  if(state.ok)$('pointer').style.left=`${(state.value+90)/180*100}%`;
  const replay=reading?.replay;
  $('validity').textContent=state.ok?(replay?'VALID · REPLAY':'VALID · SIMULATED'):`UNAVAILABLE · ${state.reason}`;
  $('validity').className=`status ${state.ok?'good':'bad'}`;
  $('details').textContent=reading?`Producer: ${reading.sourceId} · Units: ${reading.unit} · Original observation: ${reading.observedAt}${replay?` · Replay source: ${replay.sourceId} · Effective replay time: ${clockText(replay.effectiveTimeMs)}`:''} · ${reading.reason||'No errors'}`:'No current observation';
}
async function main() {
  const response=await fetch('./config.json',{cache:'no-store'}); if(!response.ok)throw new Error(`Configuration fetch failed: ${response.status}`);
  const config=validateConfiguration(await response.json()); let recording=false,recorder,replay=null;
  const bus=createBus(config,render,()=>Date.now(),reading=>{if(recording)recorder.record(reading);});
  const sources=Object.fromEntries(config.sources.filter(spec=>spec.type!=='replay').map(spec=>[spec.id,createSource(spec,bus.dispatch)]));
  const sliderSpec=config.sources.find(s=>s.type==='slider'),fixtureSpec=config.sources.find(s=>s.type==='fixture'),replaySpec=config.sources.find(s=>s.type==='replay');
  $('slider-controls').hidden=true;$('fixture-controls').hidden=true;$('replay-controls').hidden=true;
  const updateReplay=()=>{if(!replay)return;$('playback-position').textContent=`${clockText(replay.position)} / ${clockText(replay.duration)} · ${replay.speed}× · ${replay.playing?'playing':'paused'}`;$('seek').max=String(replay.duration);$('seek').value=String(replay.position);};
  function select(id) {
    bus.select(id); const isReplay=id===replaySpec?.id; $('mode').textContent=isReplay?`REPLAY · ${id}`:`SIMULATION · ${id}`;
    for(const button of $('sources').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.source===id));
    $('slider-controls').hidden=id!==sliderSpec?.id;$('fixture-controls').hidden=id!==fixtureSpec?.id;$('replay-controls').hidden=!isReplay;
    if(isReplay){if(replay)replay.start();else $('replay-message').textContent='Load a recording to replay it.';} else sources[id].start(); updateReplay();
  }
  for(const spec of config.sources){const button=document.createElement('button');button.type='button';button.textContent=spec.type==='slider'?'Virtual slider':spec.type==='fixture'?`Fixture: ${spec.id}`:'Recording replay';button.dataset.source=spec.id;button.addEventListener('click',()=>select(spec.id));$('sources').append(button);}
  $('heel-slider').value=String(sliderSpec.initial);$('slider-value').textContent=`${sliderSpec.initial}°`;
  $('heel-slider').addEventListener('input',event=>{const value=Number(event.target.value);$('slider-value').textContent=`${value}°`;if(bus.activeSource===sliderSpec.id)sources[sliderSpec.id].set(value);});
  $('next-sample').addEventListener('click',()=>sources[bus.activeSource]?.next?.());$('invalidate').addEventListener('click',()=>sources[bus.activeSource]?.invalid?.());$('clear').addEventListener('click',()=>sources[bus.activeSource]?.missing?.());
  $('record-toggle').addEventListener('click',()=>{recording=!recording;if(recording){recorder=createRecorder(config);$('record-toggle').textContent='Stop recording';$('recording-state').textContent='Recording accepted source events.';}else{$('record-toggle').textContent='Start recording';$('recording-state').textContent=`Stopped: ${recorder.size} events ready to download.`;}});
  $('download-recording').addEventListener('click',()=>{if(!recorder?.size)return;$('recording-state').textContent=`Downloading ${recorder.size} events.`;const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(recorder.export(),null,2)],{type:'application/json'}));link.download='telltales-recording.json';link.click();URL.revokeObjectURL(link.href);});
  $('recording-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const parsed=parseRecording(await file.text(),config);replay=createReplaySource(replaySpec,parsed,bus.dispatch,()=>Date.now());$('replay-message').textContent=`Loaded ${parsed.events.length} events. Original timestamps and producer identities are preserved.`;if(bus.activeSource===replaySpec.id)replay.start();updateReplay();}catch(error){$('replay-message').textContent=`Recording rejected: ${error.message}`;}});
  $('play').addEventListener('click',()=>{replay?.play();updateReplay();});$('pause').addEventListener('click',()=>{replay?.pause();updateReplay();});$('restart').addEventListener('click',()=>{replay?.restart();updateReplay();});$('seek').addEventListener('input',event=>{replay?.seek(Number(event.target.value));updateReplay();});$('speed').addEventListener('change',event=>{replay?.setSpeed(Number(event.target.value));updateReplay();});
  select(config.defaultSource);window.setInterval(()=>{replay?.tick();bus.refresh();updateReplay();},100);
}
main().catch(error=>{$('mode').textContent='CONFIGURATION ERROR';render(null,{ok:false,reason:error.message});console.error(error);});
