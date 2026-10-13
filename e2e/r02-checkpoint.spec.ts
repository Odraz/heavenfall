import { generateFloor } from '../src/gen';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { propDefs } from '../src/data/props';
import { lineOfSight } from '../src/sim/los';
import { expect, state, test } from './fixtures';
import { shootProp } from './prop-fixtures';

// These are the published Gate B selections, deliberately independent of future repins.
const seed = 317434499;
const hash = 'de6939ce';
const selections = [
  { label: 'small', room: 7, templateId: 'pg-c-1x1-flyers-03', name: 'The Ziggurat', band: 3 },
  { label: 'horde', room: 3, templateId: 'pg-c-2x2-horde-flyers-01', name: 'Courtyard of Clouds', band: 2 },
  { label: 'ranged', room: 6, templateId: 'pg-c-1x1-ranged-hazard-01', name: 'The Burning Aisle', band: 3 },
  { label: 'elite', room: 4, templateId: 'pg-c-1x1-elite-02', name: 'The Fountain Court', band: 2 },
  { label: 'hazard', room: 1, templateId: 'pg-c-1x1-hazard-01', name: 'The Gridiron', band: 1 },
] as const;

for (const classId of ['fallen', 'heretic', 'binder', 'betrayer'] as const) {
  for (const selection of selections) {
    test(`Gate B ${classId} ${selection.label} link enters the published full-pool room without God`, async ({ page }) => {
      const g = generateFloor(seed, 1, 1, PEARLY_POOL);
      expect(g.def.rooms[selection.room]).toMatchObject({ templateId: selection.templateId, name: selection.name, band: selection.band });
      await page.setViewportSize({ width: 640, height: 360 });
      await page.goto(`/?dev=1&map=rogue&seed=${seed}&room=${selection.room}&class=${classId}&god=0`);
      await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
      await page.waitForFunction(() => window.__heavenfall.activePhase === 'combat', null, { timeout: 10_000 });
      expect((await state(page)).dominion.actors).toEqual([]);
      const s = await state(page);
      expect([s.seed, s.floorHash, s.fallbackUsed, s.activeRoom]).toEqual([seed, hash, false, selection.room]);
      expect(s.players[0]).toMatchObject({ classId, dead: false, kills: 0 });
      expect(s.wallet).toBe(0);
      expect(s.props.filter((p) => p.room === selection.room).length).toBeGreaterThan(0);
      expect(s.brokenProps).toEqual([]);
      expect(s.clearedMask).toBe(((1 << g.floor.n) - 1) & ~(1 << selection.room));
      if (selection.label === 'hazard' || selection.label === 'ranged') {
        expect(s.hazards.activeRoom).toBe(selection.room);
        expect(s.hazards.activeCells).toBeGreaterThan(0);
      }
      if (classId === 'fallen') await page.screenshot({ path: test.info().outputPath(`gate-b-${selection.label}.png`) });
    });
  }
}

test('Gate B real PeerJS late entry restores a live gold pickup and broken prop, shares collection, and resets on a new menu run', async ({ page: a, browser }) => {
  test.setTimeout(180_000);
  const owned = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await owned.newContext({ viewport: { width: 320, height: 180 }, baseURL: 'http://localhost:4173' });
  const b = await context.newPage(), errors: string[] = [];
  b.on('pageerror', (e) => errors.push(e.message));
  b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await a.setViewportSize({ width: 640, height: 360 });
    await a.goto('/?dev=1&menu=1&map=rogue&god=1');
    await a.getByLabel('Player name').fill('Alice');
    await a.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    await a.getByRole('button', { name: 'Host game', exact: true }).click();
    await a.getByRole('button', { name: 'Create', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
    const id = (await a.locator('.game-id').textContent())!.trim();
    await a.getByRole('button', { name: /The Fallen/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    const first = await state(a);
    const g = generateFloor(first.seed!, 1, 1, PEARLY_POOL);
    const q = propDefs(g.floor).find((p) => p.marked)!;
    const z = g.map.floor[Math.floor(q.y) * g.map.w + Math.floor(q.x)];
    // Stay outside coin attraction so the accepted drop remains live throughout admission.
    const points = [6, 8, 5].flatMap((radius) => Array.from({ length: 32 }, (_, i) =>
      [q.x + radius * Math.cos(i * Math.PI / 16), q.y + radius * Math.sin(i * Math.PI / 16)]));
    const firingPoint = points.find(([x, y]) => {
      const c = Math.floor(x), r = Math.floor(y), index = r * g.map.w + c;
      return c > 0 && r > 0 && c < g.map.w - 1 && r < g.map.h - 1 && !g.map.solid[index] &&
        g.map.roomOf[index] === q.room && g.map.floor[index] === z && lineOfSight(g.map, x, y, z + 1.6, q.x, q.y, z + 0.5);
    });
    expect(firingPoint, `marked prop ${q.id} has a same-floor firing point outside attraction`).toBeDefined();

    // Complete the real map load before creating the 20-second pickup; hold only its ready message.
    await b.goto(`/?dev=1&menu=1&readyHold=1&join=${id}`);
    await b.getByLabel('Player name').fill('Bob');
    await b.getByRole('button', { name: `Join game ${id}` }).click();
    await b.getByRole('button', { name: 'Join', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
    await b.getByRole('button', { name: /The Binder/ }).click();
    await b.getByRole('button', { name: 'Enter game', exact: true }).click();
    await b.waitForFunction(() => typeof window.__heavenfallReady === 'function', null, { timeout: 20_000 });
    await a.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), firingPoint!);
    await expect.poll(async () => Math.hypot((await state(a)).self.x - firingPoint![0], (await state(a)).self.y - firingPoint![1])).toBeLessThan(0.2);
    await shootProp(a, q.id);
    await a.waitForFunction(() => window.__heavenfall.pickups.some((p) => p.kind === 1));
    const gold = (await state(a)).pickups.find((p) => p.kind === 1)!;
    await a.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [first.self.x, first.self.y]);
    await b.evaluate(() => window.__heavenfallReady!());
    await b.waitForFunction((id) => window.__heavenfall.screen === 'inGame' && window.__heavenfall.pickups.some((p) => p.id === id), gold.id, { timeout: 3000 });
    const late = await state(b);
    expect(late.brokenProps).toContain(q.id);
    expect(late.pickups.find((p) => p.id === gold.id)?.kind).toBe(1);
    expect([late.runId, late.seed, late.floorHash]).toEqual([first.runId, first.seed, first.floorHash]);
    expect(late.wallet).toBe(0);
    expect(late.floorSyncTick).toBeGreaterThan(0);
    await a.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [q.x, q.y]);
    await Promise.all([a, b].map((p) => p.waitForFunction(() => window.__heavenfall.wallet === 6, null, { timeout: 3000 })));
    await Promise.all([a, b].map((p) => p.waitForFunction((id) => !window.__heavenfall.pickups.some((q) => q.id === id), gold.id)));
    await a.keyboard.press('Escape');
    await a.getByRole('button', { name: 'Leave game', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'title', null, { timeout: 6000 });
    await expect(b.locator('.message')).toHaveText('Host left the game');
    for (const p of [a, b]) {
      expect(await state(p)).toMatchObject({ runId: null, wallet: 0, pickups: [], brokenProps: [], spawnWarnings: [], dominion: { casts: [] } });
    }
    // Restart in the same page through ordinary menus: no old drop, wallet or prop break survives.
    await a.getByRole('button', { name: 'Singleplayer', exact: true }).click();
    await a.getByRole('button', { name: /The Heretic Saint/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    const second = await state(a);
    expect(second.runId).not.toBe(first.runId);
    expect(second).toMatchObject({ wallet: 0, pickups: [], brokenProps: [], spawnWarnings: [], dominion: { casts: [] } });
    expect(second.players[0]).toMatchObject({ classId: 'heretic', kills: 0, dead: false });
    expect(errors).toEqual([]);
  } finally { await owned.close(); }
});
