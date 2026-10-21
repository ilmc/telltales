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
