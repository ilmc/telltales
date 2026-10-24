import{test,expect}from'@playwright/test';
test('engineering harness demonstrates heel preference variants and stale depth',async({page})=>{await page.setViewportSize({width:1540,height:720});await page.goto('/sensor-groups-demo.html?session=heel-demo&harness=true');await expect(page.locator('.subtitle')).toContainText('presentation-only HUD');await page.getByRole('button',{name:'Send fixture readings'}).click();await expect(page.locator('[data-input="heel"] .reading')).toContainText('-18.0');await page.screenshot({path:'evidence/batch-13/heel-degrees-1540x720.png'});await page.goto('/sensor-groups-demo.html?session=heel-radians&harness=true');await page.getByRole('button',{name:'Send fixture readings'}).click();await expect(page.locator('[data-input="heel"] .reading')).toContainText('-0.31');await page.goto('/sensor-groups-demo.html?session=heel-qualitative&harness=true');await page.getByRole('button',{name:'Send fixture readings'}).click();await expect(page.locator('[data-input="heel"] .reading')).toContainText('lots to port');await page.goto('/sensor-groups-demo.html?session=rich-stale-depth&harness=true');await page.getByRole('button',{name:'Send fixture readings'}).click();await expect(page.locator('[data-input="depth"] .reading')).toContainText('15.7');await page.getByRole('button',{name:'Lose installed feed'}).click();await expect(page.locator('[data-input="depth"] .meta')).toContainText('Installed sensor unavailable or stale');await page.screenshot({path:'evidence/batch-13/depth-stale-1540x720.png'})});
test('production session HUD has no installation controls and missing depth is explicit',async({page})=>{await page.setViewportSize({width:1540,height:720});await page.goto('/?view=hud&sensorSession=rich-no-depth');await expect(page.locator('button')).toHaveCount(0);await expect(page.locator('[data-input="depth"] .meta')).toContainText('No compatible sensor source');await expect(page.locator('.banner')).toContainText('other-vessel or shore wind is treated as own-vessel apparent wind');await page.screenshot({path:'evidence/batch-13/rich-missing-depth-1540x720.png'})});
test('community labels and measurement metadata render as inert text',async({page})=>{await page.goto('/sensor-groups-demo.html');await page.evaluate(async()=>{let catalog=await fetch('/examples/synthetic-sensor-groups.json').then(x=>x.json());catalog.templates[0].title='<img class="injected-title" src=x>';catalog.templates[0].inputs[0].title='<img class="injected-input" src=x>';catalog.providers[0].label='<img class="injected-provider" src=x>';let{mountSensorGroupHud}=await import('/src/sensor-groups-demo.mjs');document.body.innerHTML='';mountSensorGroupHud({catalog,harness:true})});await page.getByRole('button',{name:'Send fixture readings'}).click();await expect(page.locator('.injected-title,.injected-input,.injected-provider')).toHaveCount(0);await expect(page.locator('h1')).toContainText('<img class="injected-title" src=x>');await expect(page.locator('.sensor-card h2')).toContainText('<img class="injected-input" src=x>');await expect(page.locator('.meta')).toContainText('<img class="injected-provider" src=x>');await expect(page.locator('.meta')).toContainText('SYNTHETIC')});
test('setup classifies templates and its button launches the selected heel presentation',async({page})=>{await page.setViewportSize({width:1540,height:720});await page.goto('/?view=setup&sensorSession=heel-only-demo');await expect(page.locator('[data-group]')).toContainText('heel-only-boat');await expect(page.locator('[data-template="heel-degrees"] .compatibility')).toContainText('AVAILABLE');await expect(page.locator('[data-template="rich-instruments"] .compatibility')).toContainText('INCOMPATIBLE');await expect(page.locator('[data-template="wind-only"] .compatibility')).toContainText('INCOMPATIBLE');await page.screenshot({path:'evidence/batch-14/setup-heel-only-1540x720.png'});let card=page.locator('[data-template="heel-degrees"]');await card.getByLabel('Heel presentation unit').selectOption('rad');await card.getByRole('button',{name:'Use this display'}).click();await expect(page).toHaveURL(/view=hud.*sensorSession=heel-only-demo.*sensorTemplate=heel-degrees.*heelUnit=rad/);await expect(page.locator('.sensor-group-hud')).toHaveAttribute('data-heel-unit','rad');await expect(page.locator('.sensor-card')).toHaveCount(1)});
test('invalid local setup selections show an inert controlled error',async({page})=>{await page.goto('/?view=setup&sensorSession=%3Cimg%20class%3Dinjected%3E');await expect(page.locator('#app-error')).toHaveText('Local setup configuration is unavailable or invalid.');await expect(page.locator('.injected')).toHaveCount(0);await page.goto('/?view=hud&sensorSession=heel-demo&sensorTemplate=%3Cimg%20class%3Dinjected%3E');await expect(page.locator('#app-error')).toHaveText('Local setup configuration is unavailable or invalid.');await expect(page.locator('.injected')).toHaveCount(0)});

test('private boat profile file stays tab-local through community template selection',async({page})=>{
  await page.setViewportSize({width:1540,height:720});
  await page.goto('/?view=private-setup');
  const profile=await page.request.get('/examples/local-boat-profile.example.json').then(r=>r.text());
  await page.getByLabel('Choose local boat profile').setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(profile)});
  await expect(page.getByRole('status')).toContainText('validated');
  await expect(page.locator('[data-template="heel-degrees"] .compatibility')).toContainText('AVAILABLE');
  await page.locator('[data-template="heel-degrees"]').getByRole('button',{name:'Use this display'}).click();
  await expect(page.locator('.sensor-group-hud')).toBeVisible();
  await expect(page.locator('.subtitle')).toContainText('Private local profile');
  await page.screenshot({path:'test-results/sensor-groups-private-profile-1540x720.png'});
  await expect(page.locator('[data-input="heel"] .meta')).toContainText('UNAVAILABLE');
  await expect(page).toHaveURL(/view=private-setup/);
  await page.reload();
  await expect(page.locator('.sensor-group-hud')).toHaveCount(0);
});
test('private profile import handles bad file without injecting markup',async({page})=>{
  await page.goto('/?view=private-setup');
  await page.getByLabel('Choose local boat profile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"label":"<img class=inject src=x>"}')});
  await expect(page.getByRole('status')).toContainText('Invalid local boat profile');
  await expect(page.locator('.inject')).toHaveCount(0);
});

test('application module starts cleanly on the legacy simulator route',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?view=simulator');
  await expect(page.locator('.sim')).toBeVisible();
  expect(errors).toEqual([]);
});

test('newer private profile selection wins over delayed earlier file read',async({page})=>{
  await page.goto('/?view=private-setup');
  const profile=await page.request.get('/examples/local-boat-profile.example.json').then(r=>r.text());
  await page.evaluate(()=>{
    window.pendingPrivateReads=[];
    const original=File.prototype.text;
    File.prototype.text=function(){
      if(this.name==='slow.json')return new Promise((resolve,reject)=>window.pendingPrivateReads.push({resolve,reject}));
      return original.call(this);
    };
  });
  const picker=page.getByLabel('Choose local boat profile');
  await picker.setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from(profile)});
  await expect.poll(()=>page.evaluate(()=>window.pendingPrivateReads.length)).toBe(1);
  await picker.setInputFiles({name:'new.json',mimeType:'application/json',buffer:Buffer.from('invalid json')});
  await expect(page.getByRole('status')).toContainText('Invalid local boat profile');
  await page.evaluate(text=>window.pendingPrivateReads[0].resolve(text),profile);
  await expect(page.getByRole('status')).toContainText('Invalid local boat profile');
  await expect(page.locator('.template-card')).toHaveCount(0);
});
test('mandatory missing inputs disable private display selection',async({page})=>{
  await page.goto('/?view=private-setup');
  const profile=await page.request.get('/examples/local-boat-profile.example.json').then(r=>r.json());
  profile.sensorGroup.bindings=profile.sensorGroup.bindings.filter(x=>x.id!=='depth');
  profile.providers[0].channels=profile.providers[0].channels.filter(x=>x.id!=='depth-transducer');
  await page.getByLabel('Choose local boat profile').setInputFiles({name:'heel-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile))});
  await expect(page.getByRole('status')).toContainText('validated');
  const incompatible=page.locator('[data-template="rich-instruments"]');
  await expect(incompatible.locator('.compatibility')).toContainText('INCOMPATIBLE');
  await expect(incompatible.getByRole('button',{name:'Use this display'})).toBeDisabled();
});
