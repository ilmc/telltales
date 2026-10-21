import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const fixtures=fileURLToPath(new URL('../examples/',import.meta.url));
test('instrument workflow: controls, recording, replay and v1 compatibility',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('/');
  await expect(page.locator('[data-instrument]')).toHaveCount(2);const heel=page.locator('[data-instrument="heel"]'),sog=page.locator('[data-instrument="sog"]');
  const heelRange=page.locator('#control-heel input[type=range]'),sogRange=page.locator('#control-sog input[type=range]');await heelRange.fill('25');await expect(heel).toContainText('25 deg');await expect(sog).toContainText('0.0 kn');await sogRange.fill('6.5');await expect(sog).toContainText('6.5 kn');
  await page.getByRole('button',{name:'Emit invalid reading'}).nth(1).click();await expect(sog).toContainText('UNAVAILABLE');await expect(heel).toContainText('25 deg');
  await page.getByRole('button',{name:'Start recording'}).click();await heelRange.fill('-10');await sogRange.fill('4');await page.getByRole('button',{name:'Stop recording'}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download recording'}).click();const saved=await download;
  await page.locator('#recording-file').setInputFiles(await saved.path());await expect(page.locator('#replay-message')).toContainText('routed both instruments');await page.locator('#play').click();await page.locator('#seek').evaluate(e=>e.value=String(e.max));await page.locator('#seek').dispatchEvent('input');await expect(heel).toContainText('-10 deg');await expect(sog).toContainText('4.0 kn');
  await page.locator('#pause').click();await page.locator('#restart').click();await expect(heel).toContainText('-10 deg');await page.locator('#recording-file').setInputFiles(fixtures+'synthetic-heel-recording.json');await expect(sog).toContainText('—');
  await page.getByRole('button',{name:'Imported NMEA RMC file'}).click();await page.locator('#nmea-file').setInputFiles(fixtures+'synthetic-rmc.nmea');await expect(sog).toContainText('3.2 kn');await page.locator('#play').click();await page.locator('#seek').evaluate(e=>e.value=String(e.max));await page.locator('#seek').dispatchEvent('input');await expect(sog).toContainText('UNAVAILABLE');expect(errors).toEqual([]);
});
test('profiles reflow existing observations without resetting them',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?profile=compact');
  await expect(page.locator('body')).toHaveAttribute('data-profile','compact');await expect(page.locator('#engineering-controls')).toBeHidden();
  await expect(page.locator('[data-instrument="heel"]')).toContainText('0 deg · UPRIGHT');
  await page.locator('#profile-select').selectOption('engineering');await expect(page.locator('#engineering-controls')).toBeVisible();
  await page.locator('#control-heel input[type=range]').fill('-17');await expect(page.locator('[data-instrument="heel"]')).toContainText('-17 deg · PORT');
  await page.setViewportSize({width:1540,height:720});await page.locator('#profile-select').selectOption('wide');await expect(page.locator('body')).toHaveAttribute('data-profile','wide');await expect(page.locator('#instruments [data-instrument]').first()).toHaveAttribute('data-instrument','sog');await expect(page.locator('[data-instrument="heel"]')).toContainText('-17 deg · PORT');const sogBox=await page.locator('[data-instrument="sog"]').boundingBox(),heelBox=await page.locator('[data-instrument="heel"]').boundingBox();expect(sogBox.width).toBeGreaterThan(heelBox.width);expect(sogBox.height).toBeGreaterThanOrEqual(450);
  expect(errors).toEqual([]);
});
test('unknown URL profile falls back safely',async({page})=>{await page.goto('/?profile=bridge');await expect(page.locator('body')).toHaveAttribute('data-profile','engineering');await expect(page.locator('#profile-message')).toContainText('Unknown profile');});
test('capture Batch 5 presentation evidence',async({page})=>{
  await page.setViewportSize({width:1280,height:900});await page.goto('/?profile=engineering');await page.locator('#control-heel input[type=range]').fill('-22');await page.locator('#control-sog input[type=range]').fill('6.4');await page.screenshot({path:'evidence/batch-5/engineering.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('#profile-select').selectOption('compact');await page.screenshot({path:'evidence/batch-5/compact-mobile.png',fullPage:true});
  await page.setViewportSize({width:1540,height:720});await page.locator('#profile-select').selectOption('wide');await page.screenshot({path:'evidence/batch-5/wide-1540x720.png'});
  await page.locator('#profile-select').selectOption('engineering');await page.getByRole('button',{name:'Emit invalid reading'}).nth(1).click();await expect(page.locator('[data-instrument="sog"]')).toContainText('UNAVAILABLE');await page.screenshot({path:'evidence/batch-5/unavailable-reading.png',fullPage:true});
});
