import type { Browser, Page } from '@playwright/test';
import { expect, state, test } from './fixtures';
import { dominionLab } from '../src/data/dungeons/dominion';
import { loadMap } from '../src/sim/map';
import { dominionLeapClear } from '../src/sim/dominionLeap';

async function encounter(page: Page, god = true): Promise<void> {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=dominion&class=fallen&god=${god ? 1 : 0}&seed=7&cam=16,23,10,-90,-35`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
  await page.waitForFunction(() => window.__heavenfall.dominion.casts.length > 0, null, { timeout: 60_000 });
}

async function observeLaunch(page: Page): Promise<void> {
  const before = await state(page), cast = before.dominion.casts[0];
  const distance = Math.hypot(before.self.x - cast.x, before.self.y - cast.y);
  expect(distance).toBeLessThanOrEqual(6);
  const samples = await page.evaluate(() => new Promise<Array<{ x: number; y: number; z: number; hp: number }>>((resolve) => {
    const samples: Array<{ x: number; y: number; z: number; hp: number }> = [], end = performance.now() + 2500;
    const sample = () => {
      const s = window.__heavenfall;
      samples.push({ ...s.self, hp: s.players.find((p) => p.classId === 'fallen')!.hp });
      if (performance.now() < end) requestAnimationFrame(sample); else resolve(samples);
    };
    sample();
  }));
  expect(Math.max(...samples.map((s) => s.z - before.self.z))).toBeGreaterThan(1.5);
  expect(Math.max(...samples.map((s) => Math.hypot(s.x - cast.x, s.y - cast.y))) - distance).toBeGreaterThan(2);
  // The slam fades from 110 at its feet to 50 at the edge; the Fallen's armor takes 40%. Allow 1 HP for rounding.
  const slam = Math.round(50 + 60 * Math.max(0, 1 - distance / 6));
  expect(Math.min(...samples.map((s) => s.hp))).toBeLessThanOrEqual(before.players.find((p) => p.classId === 'fallen')!.hp - slam * 0.6 + 1);
  await page.screenshot({ path: test.info().outputPath('dominion-launch.png') });
}

async function moveAwayForLeap(page: Page): Promise<void> {
  const map = loadMap(dominionLab);
  let at: { x: number; y: number } | undefined;
  await expect.poll(async () => {
    const actor = (await state(page)).dominion.actors[0];
    if (!actor) return false;
    const points = [];
    for (let y = 7; y < 37; y++) for (let x = 2; x < 32; x++) {
      const leap = { fromX: actor.x, fromY: actor.y, fromZ: actor.z, x: x + 0.5, y: y + 0.5, z: map.floor[y * map.w + x] };
      const d = Math.hypot(leap.x - actor.x, leap.y - actor.y);
      if (d >= 20 && d <= 48 && dominionLeapClear(map, 0, leap)) points.push({ ...leap, d });
    }
    at = points.sort((a, b) => b.d - a.d)[0];
    return !!at;
  }, { timeout: 10_000, message: 'the walking Dominion reaches a clear takeoff corridor' }).toBe(true);
  await page.evaluate(({ x, y }) => window.__heavenfallTeleport!(x, y), at!);
}

async function flyingTell(page: Page) {
  const deadline = Date.now() + 15_000;
  let retreatAt = 0;
  while (Date.now() < deadline) {
    const s = await state(page);
    const cast = s.dominion.casts.find((c) => c.leap && c.impactTick - s.lastSnapshotTick >= 35);
    if (cast) return cast;
    // Keep the player distant while the ordinary slam cooldown runs; the caster still walks.
    if (Date.now() >= retreatAt && !s.dominion.casts.some((c) => c.leap)) {
      await moveAwayForLeap(page); retreatAt = Date.now() + 1500;
    }
    await page.waitForTimeout(20);
  }
  throw new Error('No native distant flying slam within 15 seconds');
}

test('a distant player gets a locked landing ring and a visible Dominion flight ending at its deadline', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/?dev=1&map=dominion&class=fallen&god=1&seed=7');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
  await page.waitForFunction(() => window.__heavenfall.dominion.actors.length > 0);
  await moveAwayForLeap(page);
  const cast = await flyingTell(page);
  expect(Math.hypot(cast!.leap!.x - cast!.leap!.fromX, cast!.leap!.y - cast!.leap!.fromY)).toBeGreaterThanOrEqual(16);
  expect(cast!.impactTick - cast!.startTick).toBe(45);
  // Observe real flight and ring positions throughout the remaining tell, rather than moving the camera.
  const samples = await page.evaluate((id) => new Promise<Array<{ tick: number; z: number; ringX?: number; ringY?: number }>>((resolve) => {
    const samples: Array<{ tick: number; z: number; ringX?: number; ringY?: number }> = [], until = performance.now() + 2200;
    const sample = () => {
      const s = window.__heavenfall, c = s.dominion.casts.find((c) => c.castId === id);
      samples.push({ tick: s.lastSnapshotTick, z: s.dominion.rendered.find((r) => r.slot === s.dominion.actors[0]?.slot)?.z ?? 0, ringX: c?.x, ringY: c?.y });
      if (performance.now() < until) requestAnimationFrame(sample); else resolve(samples);
    }; sample();
  }), cast!.castId);
  expect(samples.some((s) => s.z > Math.max(cast!.leap!.fromZ, cast!.leap!.z) + 6)).toBe(true);
  for (const sample of samples.filter((s) => s.ringX !== undefined)) { expect(sample.ringX).toBe(cast!.x); expect(sample.ringY).toBe(cast!.y); }
  const end = await state(page); expect(end.dominion.strikes).toBeGreaterThan(0);
  expect(Math.hypot(end.dominion.actors[0].x - cast!.x, end.dominion.actors[0].y - cast!.y)).toBeLessThan(1);
  await page.screenshot({ path: test.info().outputPath('dominion-leap-landing.png') });
});

test('a native slam damages and launches the player up and away without God mode', async ({ page }) => {
  await encounter(page, false);
  await observeLaunch(page);
});

test('a real PeerJS guest receives the host-authorized damaging launch', async ({ page: a, browser }) => {
  const owned = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await owned.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4173' });
  const b = await context.newPage(), errors: string[] = [];
  b.on('pageerror', (e) => errors.push(e.message));
  b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await a.setViewportSize({ width: 640, height: 360 });
    await menu(a, '/?dev=1&menu=1&map=dominion&god=0', 'Host');
    await a.getByRole('button', { name: 'Host game', exact: true }).click();
    await a.getByRole('button', { name: 'Create', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'lobby');
    const id = (await a.locator('.game-id').textContent())!.trim();
    await a.getByRole('button', { name: /The Betrayer/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'inGame');
    await menu(b, '/?dev=1&menu=1', 'Guest');
    await b.getByRole('button', { name: 'Join game', exact: true }).click();
    await b.getByLabel('Game ID').fill(id); await b.getByRole('button', { name: 'Join', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'lobby');
    await b.getByRole('button', { name: /The Fallen/ }).click();
    await b.getByRole('button', { name: 'Enter game', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
    await Promise.all([a, b].map((p) => p.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5))));
    await b.waitForFunction(() => window.__heavenfall.dominion.casts.length > 0, null, { timeout: 60_000 });
    await observeLaunch(b);
    expect(errors).toEqual([]);
  } finally { await owned.close(); }
});

test('Dominion tells are visible and a native slam preserves its crowd without kill credit', async ({ page }) => {
  await encounter(page);
  // Read the tell in the same step that finds it: a later state read can land after a 1.5 s tell ends.
  const cast = await (await page.waitForFunction(() => window.__heavenfall.dominion.casts[0] ?? false)).jsonValue();
  expect(cast && cast.impactTick - cast.startTick).toBe(45);
  const telling = await state(page);
  await page.screenshot({ path: test.info().outputPath('dominion-tell.png') });
  await page.waitForFunction(() => window.__heavenfall.dominion.rendered.some((r) => !window.__heavenfall.dominion.actors.some((a) => a.slot === r.slot) && r.z - r.floor > 1), null, { timeout: 30_000 });
  expect((await state(page)).dominion.strikes).toBeGreaterThan(0);
  expect((await state(page)).enemies).toBeGreaterThanOrEqual(telling.enemies);
  expect((await state(page)).bursts.heavy).toBe(telling.bursts.heavy);
  expect((await state(page)).players[0].kills).toBe(0);
  expect((await state(page)).wallet).toBeGreaterThanOrEqual(0);
});

test('native Blasphemy cancels the ring and prevents its scheduled strike', async ({ page }) => {
  await encounter(page);
  // Native player input: an early tell inside the real Blasphemy radius.
  const before = await state(page), cast = before.dominion.casts[0];
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await state(page)).dominion.cancels, { timeout: 3000 }).toBeGreaterThan(before.dominion.cancels);
  await page.waitForFunction((id) => !window.__heavenfall.dominion.casts.some((c) => c.castId === id), cast.castId);
  await page.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick > tick + 3, cast.impactTick);
  expect((await state(page)).dominion.strikes).toBe(before.dominion.strikes);
});

async function menu(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url); await page.waitForFunction(() => window.__heavenfall?.screen === 'title');
  await page.getByLabel('Player name').fill(name); await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
}

test('real PeerJS late entry restores the locked leap destination and deadline without restarting its tell', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await lateEntry(page, browser, false);
});
test('four real PeerJS clients preserve active Dominion deadlines and complete snapshots', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await lateEntry(page, browser, true);
});
async function lateEntry(a: Page, browser: Browser, four: boolean): Promise<void> {
  const owned: Browser[] = [];
  const errors: string[] = [];
  const progress = (stage: string): void => console.log(`Dominion four-client: ${stage}`);
  try {
    const pages: Page[] = [];
    for (let i = 0; i < (four ? 3 : 1); i++) {
      const own = await browser.browserType().launch(test.info().project.use.launchOptions ?? {}); owned.push(own);
      const context = await own.newContext({ viewport: { width: 320, height: 180 }, baseURL: 'http://localhost:4173' });
      const p = await context.newPage(); pages.push(p); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    }
    const [b, c, d] = pages;
    await a.setViewportSize({ width: 320, height: 180 });
    await menu(a, '/?dev=1&menu=1&map=dominion&god=1', 'Alice');
    await a.getByRole('button', { name: 'Host game', exact: true }).click();
    await expect(a.getByText('The Dominion encounter (dev)', { exact: true })).toBeVisible();
    await a.getByRole('button', { name: 'Create', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
    const id = (await a.locator('.game-id').textContent())!.trim();
    await a.getByRole('button', { name: /The Fallen/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 });
    await a.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5));
    await a.waitForFunction(() => window.__heavenfall.dominion.actors.length > 0, null, { timeout: 45_000 });
    progress('host encounter');
    // Admit clients separately so each real prepare/ready handshake has the ordinary 20 s budget.
    const starters: Array<[Page, string, string]> = four ? [[c, 'Cleo', 'The Heretic Saint'], [d, 'Dan', 'The Binder']] : [];
    for (const [p, name, cls] of starters) {
      await menu(p, '/?dev=1&menu=1', name); await p.getByRole('button', { name: 'Join game', exact: true }).click();
      await p.getByLabel('Game ID').fill(id); await p.getByRole('button', { name: 'Join', exact: true }).click();
      await p.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
      await p.getByRole('button', { name: new RegExp(cls) }).click();
      await p.getByRole('button', { name: 'Enter game', exact: true }).click();
      await p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 });
      progress(`${name} admitted`);
    }
    // Prepare B after the encounter arrives; its ordinary 20-second ready deadline still applies.
    const throttles = await Promise.all(starters.map(([p]) => p.context().newCDPSession(p)));
    await Promise.all(throttles.map((t) => t.send('Emulation.setCPUThrottlingRate', { rate: 8 })));
    await menu(b, '/?dev=1&menu=1&readyHold=1', 'Bob'); await b.getByRole('button', { name: 'Join game', exact: true }).click();
    await b.getByLabel('Game ID').fill(id); await b.getByRole('button', { name: 'Join', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
    await b.getByRole('button', { name: /The Betrayer/ }).click(); await b.getByRole('button', { name: 'Enter game', exact: true }).click();
    await b.waitForFunction(() => typeof window.__heavenfallReady === 'function', null, { timeout: 20_000 });
    progress('late client prepared');
    // Wait for an actual new tell. No cast/snapshot state is fabricated.
    const cast = !four ? await flyingTell(a) : await (await a.waitForFunction(() => {
      const s = window.__heavenfall; return s.dominion.casts.find((c) => c.impactTick - s.lastSnapshotTick >= 35) ?? null;
    }, null, { polling: 20, timeout: 15_000 })).jsonValue();
    await b.evaluate(() => window.__heavenfallReady!());
    const joined = await (await b.waitForFunction((id) => window.__heavenfall.dominion.casts.find((c) => c.castId === id) ?? null, cast!.castId, { polling: 20, timeout: 3000 })).jsonValue();
    expect([joined!.startTick, joined!.impactTick, joined!.incarnation]).toEqual([cast!.startTick, cast!.impactTick, cast!.incarnation]);
    expect(joined!.leap).toEqual(cast!.leap);
    if (!four) expect(joined!.leap).toBeDefined();
    expect((await state(b)).floorSyncTick).toBeGreaterThanOrEqual(cast!.startTick);
    expect((await state(b)).dominion.startedCastIds, 'the caught-up cast never replays a reliable start cue').not.toContain(cast!.castId);
    expect((await state(b)).players.find((p) => p.classId === 'betrayer')?.dead).toBe(true);
    expect(await b.evaluate(() => typeof window.__heavenfallReady)).toBe('undefined');
    await Promise.all(throttles.map((t) => t.send('Emulation.setCPUThrottlingRate', { rate: 1 })));
    await b.waitForFunction(() => window.__heavenfall.dominion.strikes > 0, null, { timeout: 5000 });
    progress('matching deadline and impact');
    let ticks = await Promise.all(pages.map(async (p) => (await state(p)).lastSnapshotTick));
    for (let i = 0; i < 30; i++) {
      await a.waitForTimeout(1000);
      for (let k = 0; k < pages.length; k++) {
        const p = pages[k];
        await p.waitForFunction((tick) => window.__heavenfall.lastSnapshotTick > tick, ticks[k], { timeout: 3000, polling: 100 });
        const s = await state(p), host = await state(a);
        expect(s.runId).toBe(host.runId); expect(host.enemyCountsByTick[s.lastSnapshotTick]).toBe(s.enemies); ticks[k] = s.lastSnapshotTick;
      }
      expect((await state(a)).netOutKBps).toBeLessThanOrEqual(437);
      if ((i + 1) % 10 === 0) progress(`snapshot ${i + 1}/30`);
    }
    await a.keyboard.press('Escape'); await a.getByRole('button', { name: 'Leave game', exact: true }).click();
    await Promise.all(pages.map((p) => p.waitForFunction(() => window.__heavenfall.screen === 'title', null, { timeout: 6000 })));
    expect(errors).toEqual([]);
  } finally { await Promise.all(owned.map((own) => own.close())); }
}
