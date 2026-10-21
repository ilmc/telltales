import {validateConfiguration,createBus,createSource} from './core.mjs';
const $ = id => document.getElementById(id);
function render(reading, state) {
  $('reading').textContent = state.ok ? `${state.value.toFixed(0)}°` : '—';
  $('pointer').hidden = !state.ok;
  if (state.ok) $('pointer').style.left = `${(state.value + 90)/180*100}%`;
  $('validity').textContent = state.ok ? 'VALID · SIMULATED' : `UNAVAILABLE · ${state.reason}`;
  $('validity').className = `status ${state.ok ? 'good':'bad'}`;
  $('details').textContent = reading ? `Source: ${reading.sourceId} · Units: ${reading.unit} · Observed: ${reading.observedAt} · ${reading.reason || 'No errors'}` : 'No current observation';
}
async function main() {
  const response = await fetch('./config.json',{cache:'no-store'});
  if (!response.ok) throw new Error(`Configuration fetch failed: ${response.status}`);
  const config = validateConfiguration(await response.json());
  const bus = createBus(config,render);
  const sources = Object.fromEntries(config.sources.map(spec=>[spec.id,createSource(spec,bus.dispatch)]));
  const sliderSpec = config.sources.find(s=>s.type==='slider');
  const fixtureSpec = config.sources.find(s=>s.type==='fixture');
  $('slider-controls').hidden = true; $('fixture-controls').hidden = true;
  function select(id) {
    bus.select(id);
    $('mode').textContent = `SIMULATION · ${id}`;
    for (const button of $('sources').querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.source===id));
    $('slider-controls').hidden = id !== sliderSpec?.id;
    $('fixture-controls').hidden = id !== fixtureSpec?.id;
    sources[id].start();
  }
  for (const spec of config.sources) {
    const button = document.createElement('button');
    button.type='button'; button.textContent=spec.type==='slider'?'Virtual slider':`Fixture: ${spec.id}`;
    button.dataset.source=spec.id;button.addEventListener('click',()=>select(spec.id));
    $('sources').append(button);
  }
  if (sliderSpec) {
    $('heel-slider').value=String(sliderSpec.initial);
    $('slider-value').textContent=`${sliderSpec.initial}°`;
    $('heel-slider').addEventListener('input',event=>{
      const value=Number(event.target.value);
      $('slider-value').textContent=`${value}°`;
      if (bus.activeSource===sliderSpec.id) sources[sliderSpec.id].set(value);
    });
  }
  $('next-sample').addEventListener('click',()=>sources[bus.activeSource]?.next?.());
  $('invalidate').addEventListener('click',()=>sources[bus.activeSource].invalid());
  $('clear').addEventListener('click',()=>sources[bus.activeSource].missing());
  select(config.defaultSource);
  window.setInterval(()=>bus.refresh(),1000);
}
main().catch(error=>{
  $('mode').textContent='CONFIGURATION ERROR';
  render(null,{ok:false,reason:error.message});
  console.error(error);
});
