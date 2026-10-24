import { test, expect } from '@playwright/test';

test('a stale image callback cannot replace a newer loaded frame', async ({ browser }) => {
  let context = await browser.newContext(),
    release,
    gate = new Promise((resolve) => (release = resolve)),
    fixture = await context.newPage(),
    hud = await context.newPage();
  await hud.route('**/examples/synthetic-surface.svg?frame=1', async (route) => {
    await gate;
    await route.continue();
  });
  await fixture.goto('/?view=surface-fixture');
  await hud.goto('/?view=hud&template=zo-hud-surface');
  await fixture.locator('#frame').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('LIVE');
  await expect(hud.locator('.surface-frame img')).toHaveAttribute('src', /frame=2/);
  release();
  await new Promise((resolve) => setTimeout(resolve, 100));
  await expect(hud.locator('.surface-frame img')).toHaveAttribute('src', /frame=2/);
  await context.close();
});

test('late subscribers receive periodic frames and configured dimensions and fit drive the surface', async ({
  browser,
}) => {
  let context = await browser.newContext();
  await context.route('**/config.json', async (route) => {
    let response = await route.fetch(),
      config = await response.json(),
      surface = config.widgets.find((x) => x.id === 'external-surface');
    surface.props.nativeSize = { width: 640, height: 480 };
    surface.props.fit = 'cover';
    await route.fulfill({ response, json: config });
  });
  let fixture = await context.newPage(),
    hud = await context.newPage(),
    sim = await context.newPage();
  await fixture.goto('/?view=surface-fixture');
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await hud.setViewportSize({ width: 1540, height: 720 });
  await hud.goto('/?view=hud&template=zo-hud-surface');
  await sim.goto('/?view=simulator');
  await expect(hud.locator('.hud-surface')).toHaveCSS('width', '640px');
  await expect(hud.locator('.hud-surface')).toHaveCSS('height', '480px');
  await expect(hud.locator('.surface-frame img')).toHaveCSS('object-fit', 'cover');
  await expect(hud.locator('.hud-surface .status')).toContainText('LIVE');
  await fixture.locator('#stale').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('timeout', { timeout: 5000 });
  await context.close();
});

test('zo surface preserves its native size and surface lifecycle', async ({ browser }) => {
  let context = await browser.newContext(),
    hud = await context.newPage(),
    sim = await context.newPage(),
    fixture = await context.newPage();
  await hud.setViewportSize({ width: 1540, height: 720 });
  await hud.goto('/?view=hud&template=zo-hud-surface');
  await sim.goto('/?view=simulator');
  await fixture.goto('/?view=surface-fixture');
  await expect(hud.locator('.hud-surface')).toHaveCSS('width', '720px');
  await expect(hud.locator('.hud-surface .status')).toContainText('LIVE');
  await expect(hud.locator('.hud-speed .status')).toContainText('SYNTHETIC');
  await fixture.locator('#reset').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('UNAVAILABLE');
  await fixture.locator('#frame').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('LIVE');
  await fixture.locator('#stale').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('timeout', { timeout: 5000 });
  await fixture.locator('#frame').click();
  await fixture.locator('#broken').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('could not be loaded');
  await fixture.locator('#frame').click();
  await fixture.locator('#stop').click();
  await expect(hud.locator('.hud-surface .status')).toContainText('shutdown');
  await context.close();
});

test('surface templates position a reusable signed heel widget without controls on the HUD', async ({
  browser,
}) => {
  let context = await browser.newContext(),
    hud = await context.newPage(),
    sim = await context.newPage(),
    fixture = await context.newPage();
  await hud.setViewportSize({ width: 1540, height: 720 });
  await hud.goto('/?view=hud&template=surface-hud-instruments');
  await sim.goto('/?view=simulator');
  await fixture.goto('/?view=surface-fixture');
  await sim.locator('#control-heel input[type="range"]').fill('-18');
  await expect(hud.locator('[data-widget="primary-heel"] .heel-value')).toContainText('-18');
  await expect(hud.locator('[data-widget="primary-heel"] .heel-direction')).toContainText('PORT');
  await expect(hud.locator('[data-widget="primary-heel"] .status')).toContainText('SYNTHETIC');
  await expect(hud.locator('.hud-surface .status')).toContainText('LIVE');
  await expect(hud.locator('[data-widget="primary-heel"]')).toHaveAttribute(
    'data-slot',
    'starboard-top'
  );
  await expect(hud.locator('button')).toHaveCount(0);
  await hud.screenshot({ path: 'evidence/batch-15/surface-heel-1540x720.png' });
  await context.close();
});
