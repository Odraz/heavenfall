import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures';

async function encounter(page: Page, family: string, invulnerable = false) {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=${family}&class=fallen&god=${family === 'carrier' && !invulnerable ? 0 : 1}&seed=7&cam=16,23,10,-90,-35`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
  await page.waitForFunction(() => window.__heavenfall.commanders.length > 0, null, { timeout: 45000 });
}

test('Cantor loads its atlas, opens the hymnal for a host beam and Blasphemy cancels it', async ({ page }) => {
  await encounter(page, 'cantor');
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.kind === 'beam' && c.phase === 'tell'), null, { timeout: 20000 });
  const warning = (await state(page)).commanders.find((c) => c.kind === 'beam')!;
  expect(warning.endTick - warning.phaseTick).toBe(75);
  await page.screenshot({ path: test.info().outputPath('cantor-warning.png') });
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.kind === 'beam' && c.phase === 'active'), null, { timeout: 20000 });
  const c = (await state(page)).commanders[0]; expect(c.endTick - c.phaseTick).toBe(90);
  await page.screenshot({ path: test.info().outputPath('cantor-singing.png') });
  await page.evaluate(({ x, y }) => window.__heavenfallTeleport!(x, y), { x: c.x + 2, y: c.y });
  await page.keyboard.press('KeyQ');
  await page.waitForFunction((id) => window.__heavenfall.commanders.some((c) => c.castId === id && c.phase === 'recover'), c.castId, { timeout: 3000 });
  expect((await state(page)).players[0].dead).toBe(false);
});

for (const family of ['cantor', 'carrier']) test(`${family}: a real PeerJS late join restores the current cast identity and deadline`, async ({ page: host, browser }) => {
  const own = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const errors: string[] = [];
  try {
    const guest = await own.newPage({ viewport: { width: 320, height: 180 }, baseURL: 'http://localhost:4173' });
    guest.on('pageerror', (e) => errors.push(e.message));
    guest.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await host.setViewportSize({ width: 320, height: 180 });
    const menu = async (page: Page, url: string, name: string) => {
      await page.goto(url); await page.waitForFunction(() => window.__heavenfall?.screen === 'title');
      await page.getByLabel('Player name').fill(name);
      await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    };
    await menu(host, `/?dev=1&menu=1&map=${family}&god=1&seed=7`, 'Host');
    await host.getByRole('button', { name: 'Host game', exact: true }).click();
    await host.getByRole('button', { name: 'Create', exact: true }).click();
    await host.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
    const id = (await host.locator('.game-id').textContent())!.trim();
    await host.getByRole('button', { name: /The Fallen/ }).click();
    await host.getByRole('button', { name: 'Start', exact: true }).click();
    await host.waitForFunction(() => window.__heavenfall.screen === 'inGame');
    await host.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
    await host.waitForFunction(() => window.__heavenfall.commanders.length > 0);
    await menu(guest, '/?dev=1&menu=1&readyHold=1', 'Guest');
    await guest.getByRole('button', { name: 'Join game', exact: true }).click();
    await guest.getByLabel('Game ID').fill(id);
    await guest.getByRole('button', { name: 'Join', exact: true }).click();
    await guest.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30000 });
    await guest.getByRole('button', { name: /The Betrayer/ }).click();
    await guest.getByRole('button', { name: 'Enter game', exact: true }).click();
    await guest.waitForFunction(() => typeof window.__heavenfallReady === 'function', null, { timeout: 20000 }).catch(async (error) => {
      console.log(`${family} guest preparation`, await guest.locator('body').innerText(), errors);
      throw error;
    });
    const cast = await (await host.waitForFunction((family) => window.__heavenfall.commanders.find((c) => c.phase === (family === 'cantor' ? 'tell' : 'active') && c.endTick - window.__heavenfall.lastSnapshotTick >= 20), family, { polling: 20, timeout: 15000 })).jsonValue();
    await guest.evaluate(() => window.__heavenfallReady!());
    const restored = await (await guest.waitForFunction((id) => window.__heavenfall.commanders.find((c) => c.castId === id), cast!.castId, { polling: 20, timeout: 3000 })).jsonValue();
    expect([restored!.incarnation, restored!.startTick, restored!.endTick, restored!.kind]).toEqual([cast!.incarnation, cast!.startTick, cast!.endTick, cast!.kind]);
    expect((await state(guest)).floorSyncTick).toBeGreaterThanOrEqual(cast!.startTick);
    const tick = (await state(guest)).lastSnapshotTick;
    await guest.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick > tick + 30, tick);
    expect(errors).toEqual([]);
  } finally { await own.close(); }
});

test('Carrier holds the victim despite movement, shooting and ability presses, then restores controls on release', async ({ page }) => {
  await encounter(page, 'carrier');
  await page.locator('.game-canvas').click({ position: { x: 300, y: 160 } });
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.waitForFunction(() => window.__heavenfall.commanders.some((c) => c.phase === 'active'), null, { polling: 20, timeout: 45000 });
  const grab = await (await page.waitForFunction(() => window.__heavenfall.commanders.find((c) => c.phase === 'carry'), null, { polling: 20, timeout: 3000 })).jsonValue();
  const before = (await state(page)).players[0];
  await page.keyboard.down('KeyW');
  await page.mouse.down();
  await page.keyboard.press('KeyQ');
  await page.keyboard.down('KeyE');
  await page.keyboard.press('Digit1'); await page.keyboard.press('Digit2');
  const carried = await (await page.waitForFunction((z) => {
    const s = window.__heavenfall, c = s.commanders.find((c) => c.phase === 'carry');
    return c && s.self.z > z + 3 ? { self: { ...s.self }, c } : null;
  }, grab!.targetZ, { polling: 20, timeout: 2000 })).jsonValue();
  await page.keyboard.up('KeyW');
  expect(Math.hypot(carried!.self.x - carried!.c.x, carried!.self.y - carried!.c.y)).toBeLessThan(1);
  await page.waitForFunction(tick => window.__heavenfall.lastSnapshotTick >= tick + 60, grab!.phaseTick);
  const held = await state(page);
  expect(held.commanders.find(c => c.castId === grab!.castId)?.phase).toBe('carry');
  expect(held.star).toBeNull();
  expect([held.players[0].primaryShots, held.players[0].secondaryShots]).toEqual([before.primaryShots, before.secondaryShots]);
  await page.mouse.up(); await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__heavenfall.commanders.every((c) => c.phase !== 'carry'), null, { timeout: 3000 });
  await page.keyboard.press('KeyG');
  await page.mouse.down();
  await page.waitForFunction(shots => window.__heavenfall.players[0].primaryShots > shots, before.primaryShots);
  await page.mouse.up();
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__heavenfall.star !== null);
  await page.keyboard.up('KeyE');
  await page.screenshot({ path: test.info().outputPath('carrier-release.png') });
  expect((await state(page)).players[0].dead).toBe(false);
});

test('Carrier holds the victim above the horde for at least three seconds before dropping', async ({ page }) => {
  await encounter(page, 'carrier');
  const grab = await (await page.waitForFunction(() => {
    const s = window.__heavenfall, c = s.commanders.find(c => c.phase === 'carry');
    return c ? { c, hp: s.players[0].hp } : null;
  }, null, { polling: 20, timeout: 45000 })).jsonValue();
  expect(grab!.c.endTick - grab!.c.phaseTick).toBeGreaterThanOrEqual(90);
  const held = await (await page.waitForFunction(({ id, tick }) => {
    const s = window.__heavenfall, c = s.commanders.find(c => c.castId === id);
    return c && s.lastSnapshotTick >= tick + 60 ? { c, z: s.self.z, hp: s.players[0].hp } : null;
  }, { id: grab!.c.castId, tick: grab!.c.phaseTick }, { polling: 20, timeout: 5000 })).jsonValue();
  expect(held!.c.phase).toBe('carry'); expect(held!.z).toBeGreaterThan(grab!.c.targetZ + 3);
  expect(held!.hp).toBeLessThanOrEqual(grab!.hp - 24 + 1e-6); // Four 10-damage pulses through Fallen's 40% armor.
  const released = await (await page.waitForFunction(id => window.__heavenfall.commanders.find(c => c.castId === id && c.phase === 'recover'), grab!.c.castId, { polling: 20, timeout: 5000 })).jsonValue();
  expect(released!.phaseTick - grab!.c.phaseTick).toBeGreaterThanOrEqual(90);
  expect((await state(page)).players[0].dead).toBe(false);
});

test('a missed Carrier dive climbs back into the air instead of freezing beside the player', async ({ page }) => {
  await encounter(page, 'carrier', true);
  const flight = await (await page.waitForFunction(() => window.__heavenfall.commanders.find(c =>
    c.kind === 'carry' && c.phase === 'active' && window.__heavenfall.lastSnapshotTick - c.phaseTick <= 6),
  null, { polling: 20, timeout: 45000 })).jsonValue();
  const result = await page.evaluate(async id => {
    const samples: Array<{ x: number; y: number; z: number; phase: string }> = [];
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
      const s = window.__heavenfall, c = s.commanders.find(c => c.castId === id);
      if (c) {
        samples.push({ x: c.x, y: c.y, z: c.z, phase: c.phase });
        if (c.phase === 'recover' && s.lastSnapshotTick - c.phaseTick >= 30) return samples;
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    throw new Error('Missed Carrier flight did not complete recovery climb');
  }, flight!.castId);
  expect(result.some(c => c.phase === 'carry')).toBe(false);
  expect(Math.min(...result.map(c => c.z))).toBeLessThan(flight!.z - 0.5);
  expect(result.at(-1)!.z).toBeGreaterThanOrEqual(5.9);
  expect(Math.hypot(result.at(-1)!.x - flight!.x, result.at(-1)!.y - flight!.y)).toBeGreaterThan(3);
});
