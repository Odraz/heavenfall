/** R7: the authored Gatekeeper in the production client, solo and over real PeerJS (rogue bosses.md §3). */
import type { Page } from '@playwright/test';
import { generateFloor } from '../src/gen';
import { PINNED } from '../src/gen/pinned';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { BOSS_CAST_TOLL } from '../src/data/gatekeeper';
import { expect, state, test } from './fixtures';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
const BOSS = g.floor.boss;
const ready = (page: Page) => page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 3);

/** The local body every animation frame for `ms`: the largest step between frames and the distance moved. */
function track(page: Page, ms: number): Promise<{ frames: number; maxStep: number; moved: number }> {
  return page.evaluate((ms) => new Promise((done) => {
    const pts: Array<[number, number]> = [];
    const end = performance.now() + ms;
    const frame = () => {
      const s = window.__heavenfall.self;
      pts.push([s.x, s.y]);
      if (performance.now() < end) requestAnimationFrame(frame);
      else {
        let maxStep = 0;
        for (let i = 1; i < pts.length; i++) maxStep = Math.max(maxStep, Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        done({ frames: pts.length, maxStep, moved: Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) });
      }
    };
    requestAnimationFrame(frame);
  }), ms);
}

test('solo: the seal line, a Call that holds you on a smooth predicted drag, the Toll ring and the crosshair eye', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${BOSS}&class=betrayer&god=1`);
  await ready(page);
  await page.waitForFunction(() => window.__heavenfall.boss?.phase === 1, null, { timeout: 30_000 });
  await expect(page.locator('.boss-name')).toHaveText('The Gatekeeper');
  // Solo: 0.30 of 52 000.
  expect((await state(page)).boss!.maxHp).toBe(15600);
  // Called to the Gate at c 4: held from c 5, the screen predicts the drag.
  await page.waitForFunction(() => window.__heavenfall.boss?.held === 0 && window.__heavenfall.boss.heldLocal, null, { timeout: 15_000 });
  await expect(page.locator('.called-text')).toHaveText('You are called: shoot the seal!');
  await page.waitForFunction(() => window.__heavenfall.boss?.seals === 1, null, { timeout: 2000 });
  const drag = await track(page, 1200);
  // 2.5 m/s, glided every frame: no 10 Hz snapshot steps (a 0.25 m jump would be one).
  expect(drag.moved).toBeGreaterThan(1.5);
  expect(drag.moved).toBeLessThan(3.6);
  expect(drag.maxStep).toBeLessThan(0.15);
  // Facing him: the chain runs from his keys through the Seal, 1.5 m ahead at eye height.
  const s0 = await state(page), [bx, by] = s0.boss!.at, seal = s0.boss!.seal!;
  expect(Math.hypot(seal[0] - s0.self.x, seal[1] - s0.self.y)).toBeLessThan(1.6);
  await page.evaluate(([x, y]) => window.__heavenfallLook!(Math.atan2(y, x), 0.05), [bx - s0.self.x, by - s0.self.y]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: test.info().outputPath('called.png') });
  // The Toll at c 8: its ring rolls from the announced impact.
  await page.waitForFunction((toll) => window.__heavenfall.boss?.cast === toll, BOSS_CAST_TOLL, { timeout: 15_000 });
  await expect(page.locator('.boss-cast-label')).toHaveText('The Toll');
  await page.waitForFunction(() => (window.__heavenfall.boss?.rings.length ?? 0) > 0, null, { timeout: 5000 });
  // 1.5 s of tell, then the ring rolls out at 9.5 m/s: about 25 m from him 2.4 s later.
  await page.waitForTimeout(3900);
  await page.screenshot({ path: test.info().outputPath('toll-ring.png') });
  // The 6 s pre-warning at c 22: the crosshair eye shows whether he can see you.
  await page.waitForFunction(() => (window.__heavenfall.boss?.cycle ?? 0) >= 22.5 * 30, null, { timeout: 25_000 });
  expect(['full', 'none']).toContain((await state(page)).boss!.sight);
  await page.waitForFunction(() => window.__heavenfall.boss?.cast === 2, null, { timeout: 10_000 });
  await expect(page.locator('.boss-cast-label')).toHaveText('Judgment');
  await page.screenshot({ path: test.info().outputPath('judgment.png') });
});

test('co-op over PeerJS: the held player glides on their own screen; the partner sees the padlock, the chain and the ring', async ({ page: a, browser }) => {
  test.setTimeout(180_000);
  const owned = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await owned.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4173' });
  const b = await context.newPage(), errors: string[] = [];
  b.on('pageerror', (e) => errors.push(e.message)); b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await a.setViewportSize({ width: 640, height: 360 });
    for (const [p, name, url] of [[a, 'Alice', `/?dev=1&menu=1&map=rogue&seed=${PINNED.seed}&room=${BOSS}&god=1`], [b, 'Bob', '/?dev=1&menu=1']] as const) {
      await p.goto(url); await p.getByLabel('Player name').fill(name); await p.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    }
    await a.getByRole('button', { name: 'Host game', exact: true }).click(); await a.getByRole('button', { name: 'Create', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'lobby'); const id = (await a.locator('.game-id').textContent())!.trim();
    await b.getByRole('button', { name: 'Join game', exact: true }).click(); await b.getByLabel('Game ID').fill(id); await b.getByRole('button', { name: 'Join', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'lobby');
    await a.getByRole('button', { name: /The Betrayer/ }).click(); await b.getByRole('button', { name: /The Binder/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await Promise.all([a, b].map((p) => p.waitForFunction(() => window.__heavenfall.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 3, null, { timeout: 30_000 })));
    await Promise.all([a, b].map((p) => p.waitForFunction(() => window.__heavenfall.boss?.phase === 1, null, { timeout: 30_000 })));
    // Two humans: f(2) = 0.55 of 52 000 on both screens.
    expect((await state(b)).boss!.maxHp).toBe(28600);
    await b.waitForFunction(() => (window.__heavenfall.boss?.held ?? 255) !== 255, null, { timeout: 20_000 });
    const held = (await state(b)).boss!.held;
    const [mine, other] = held === 0 ? [a, b] : [b, a];
    await mine.waitForFunction(() => window.__heavenfall.boss?.heldLocal === true, null, { timeout: 3000 });
    const drag = await track(mine, 1200);
    expect(drag.moved).toBeGreaterThan(1.5);
    expect(drag.maxStep).toBeLessThan(0.15);
    await expect(other.locator('.party-frame.held')).toHaveCount(1);
    await other.screenshot({ path: test.info().outputPath('partner-sees-call.png') });
    // The Seal is a boss part on both screens; the ring's impact reaches the guest's header too.
    await other.waitForFunction(() => window.__heavenfall.boss?.seals === 1, null, { timeout: 2000 });
    await b.waitForFunction(() => (window.__heavenfall.boss?.rings.length ?? 0) > 0, null, { timeout: 20_000 });
    const [ha, hb] = [(await state(a)).boss!, (await state(b)).boss!];
    expect(hb.rings[hb.rings.length - 1]).toBe(ha.rings[ha.rings.length - 1]);
    await b.screenshot({ path: test.info().outputPath('guest-ring.png') });
    expect(errors).toEqual([]);
  } finally { await owned.close(); }
});

test('the Edict of the Trumpet opens the Watchers in the first cycle: grey, then shootable, with the crosshair eye', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${BOSS}&class=heretic&god=1&edicts=5`);
  await ready(page);
  await page.waitForFunction(() => window.__heavenfall.boss?.phase === 1, null, { timeout: 30_000 });
  // c 17: 3 + 1 living = 4 eyes, each placed within 20 m and sight of the solo player.
  await page.waitForFunction(() => window.__heavenfall.boss?.eyes === 4, null, { timeout: 30_000 });
  expect((await state(page)).boss!.flags & 2).toBe(2);
  const s0 = await state(page), [bx, by] = s0.boss!.at;
  await page.evaluate(([x, y]) => window.__heavenfallLook!(Math.atan2(y, x), 0.25), [bx - s0.self.x, by - s0.self.y]);
  await page.waitForTimeout(2500);
  expect(['full', 'half', 'none']).toContain((await state(page)).boss!.sight);
  await page.screenshot({ path: test.info().outputPath('watchers.png') });
});
