import { floorHash, fmix32, generateFloor } from '../src/gen';
import { PINNED } from '../src/gen/pinned';
import { PEARLY_POOL_R1 } from '../src/data/rooms/1';
import { expect, state, test } from './fixtures';

test('a second generated run after Results gets a fresh identity and accepts restarted input and snapshots', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=999&class=fallen&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.activePhase === 'combat');
  await expect(page.locator('.room-message')).toHaveText('The Gatekeeper · Inherited fight fixture (authored encounter arrives in R7)');
  const first = await state(page);
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => window.__heavenfall.screen === 'results', null, { timeout: 10_000 });
  expect((await state(page)).gameResult).toBe('victory');
  await page.getByRole('button', { name: 'Back to title' }).click();
  expect((await state(page)).runId).toBeNull();
  await page.getByLabel('Player name').fill('Again');
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await page.getByRole('button', { name: /The Heretic Saint/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0 && window.__heavenfall.floorSyncTick >= 0);
  const second = await state(page);
  expect(second.runId).toMatch(/^[0-9a-f]{32}$/); expect(second.runId).not.toBe(first.runId);
  expect(second.gameResult).toBeNull(); expect(second.floorSyncTick).toBe(0);
  expect(second.players[0]).toMatchObject({ classId: 'heretic', hp: 150, kills: 0, dead: false, primaryShots: 0, secondaryShots: 0 });
  // Input sequences restart, and the map flag survives the new wire format.
  await page.locator('.game-canvas').click({ position: { x: 300, y: 160 } });
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.down('KeyM');
  await expect(page.getByLabel('Full floor map')).toBeVisible();
  await page.keyboard.up('KeyM');
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.ability').filter({ hasText: 'Q' })).not.toHaveClass(/ready/);
  await page.waitForFunction(() => window.__heavenfall.activePhase === 'combat');
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => window.__heavenfall.screen === 'results', null, { timeout: 10_000 });
  expect((await state(page)).gameResult).toBe('victory');
});

test('the map shows Breach neighbours; holding M keeps movement and diverts mouse and attacks', async ({ page }) => {
  const { floor, def } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=fallen&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.floorSyncTick >= 0 && window.__heavenfall.lastSnapshotTick > 0);
  const neighbours = def.rooms[0].leaves.map((l) => l.to);
  expect((await state(page)).roomKnowledge).toEqual(floor.rooms.map((_r, i) => i === 0 ? 2 : neighbours.includes(i) ? 1 : 0));
  const known = page.getByRole('list', { name: 'Known rooms' });
  await expect(known.getByRole('listitem')).toHaveCount(neighbours.length + 1);
  await expect(known).toContainText(`${def.rooms[0].name} — Cleared`);
  for (const i of neighbours) await expect(known).toContainText(`${def.rooms[i].name} — Discovered`);
  await expect(page.getByLabel('Floor minimap')).toBeVisible();
  await page.locator('.game-canvas').click({ position: { x: 500, y: 300 } });
  await page.waitForFunction(() => document.pointerLockElement !== null);
  const before = await state(page);
  await page.keyboard.down('KeyM');
  await expect(page.getByLabel('Full floor map')).toBeVisible();
  await page.mouse.move(660, 340);
  await page.mouse.down({ button: 'left' }); await page.mouse.down({ button: 'right' });
  await page.keyboard.down('KeyW');
  await expect.poll(async () => Math.hypot((await state(page)).self.x - before.self.x, (await state(page)).self.y - before.self.y)).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyW'); await page.mouse.up({ button: 'left' }); await page.mouse.up({ button: 'right' });
  const after = await state(page);
  expect(after.self.yaw).toBe(before.self.yaw); expect(after.self.pitch).toBe(before.self.pitch);
  expect(after.players[0].primaryShots).toBe(before.players[0].primaryShots);
  expect(after.players[0].secondaryShots).toBe(before.players[0].secondaryShots);
  expect(after.paused).toBe(false);
  await page.screenshot({ path: test.info().outputPath('r1.5-full-map.png') });
  await page.keyboard.up('KeyM'); await expect(page.getByLabel('Full floor map')).toBeHidden();
  await page.keyboard.down('KeyM'); await expect(page.getByLabel('Full floor map')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByLabel('Full floor map')).toBeHidden();
  expect((await state(page)).paused).toBe(true);
  await page.keyboard.up('KeyM');
});

test('empty special rooms identify their later-milestone fixtures', async ({ page }) => {
  const { floor } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&room=${floor.pardoner}&class=fallen&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await expect(page.locator('.room-message')).toHaveText('The Pardoner · Empty stall (shop arrives in R3)');
  const { def } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  const [x, y] = def.rooms[floor.confessional].entry[0].cells[0];
  await page.evaluate(([x, y]) => window.__heavenfallTeleport!(x + 0.5, y + 0.5), [x, y]);
  await expect(page.locator('.room-message')).toHaveText('The Confessional · Empty shell (Advocate arrives in R4)');
});

test('two browser clients reproduce the pinned Node floor and dev entry positions', async ({ page: a, browser }) => {
  const generated = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  const nodeHash = floorHash(generated.def);
  expect(nodeHash).toBe(PINNED.floorHash);
  const expectedSimSeed = fmix32((PINNED.seed ^ 0x53494d) >>> 0);
  const own = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await own.newContext({ viewport: { width: 640, height: 360 } });
  const b = await context.newPage();
  const errors: string[] = [];
  b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  b.on('pageerror', (e) => errors.push(e.message));
  try {
    await a.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=fallen&room=0`);
    await a.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    await a.setViewportSize({ width: 320, height: 180 });
    await b.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=binder&room=999&god=1`);
    await b.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0, null, { timeout: 30_000 });
    await b.waitForFunction(() => window.__heavenfall.activePhase === 'combat', null, { timeout: 10_000 });
    for (const [page, room] of [[a, 0], [b, generated.floor.boss]] as const) {
      const s = await state(page);
      expect(s.floorHash).toBe(nodeHash);
      expect(s.seed).toBe(PINNED.seed);
      expect(s.simSeed).toBe(expectedSimSeed);
      expect(s.attempts).toBe(PINNED.attempts);
      expect(s.fallbackUsed).toBe(false);
      expect(s.activeRoom).toBe(room === 0 ? 255 : generated.floor.boss);
      expect(s.activePhase).toBe(room === 0 ? 'idle' : 'combat');
      expect(s.clearedMask).toBe(((1 << generated.floor.n) - 1) & (room === 0 ? ~0 : ~(1 << generated.floor.boss)));
      if (room === 0) expect(s.enemies).toBe(0);
      else expect(s.enemies).toBeGreaterThan(0);
      const [c, r] = generated.def.rooms[room].entry[0].cells[0];
      await expect.poll(async () => {
        const { self } = await state(page);
        return [self.x, self.y, self.z];
      }).toEqual([c + 0.5, r + 0.5, generated.map.floor[r * generated.map.w + c]]);
    }
    expect((await state(a)).runId).not.toBe((await state(b)).runId);
    await a.keyboard.press('F3');
    await expect(a.locator('.debug-overlay')).toContainText(`Seed ${PINNED.seed}`);
    expect(errors).toEqual([]);
  } catch (error) {
    await test.info().attach('second-client-loading', {
      body: JSON.stringify({ errors, state: await state(b).catch(() => null), text: await b.locator('body').innerText().catch(() => '') }), contentType: 'application/json',
    });
    throw error;
  } finally {
    await own.close();
  }
});

test('solo autopilot clears the pinned generated floor and reaches the inherited boss', async ({ page }) => {
  test.setTimeout(900_000);
  const { floor, def } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  await page.setViewportSize({ width: 320, height: 180 });
  await page.goto(`/?dev=1&map=rogue&seed=${PINNED.seed}&class=fallen&bot=1&god=1`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });
  const seen = new Set<number>();
  let latestMask = 0, lastProgress = Date.now(), lastWave = -1, lastRoom = 255;
  for (;;) {
    const s = await state(page);
    if (s.gameResult !== null) break;
    const wave = s.director?.wave ?? -1;
    if (s.clearedMask !== latestMask || s.activeRoom !== lastRoom || wave !== lastWave) {
      latestMask = s.clearedMask; lastRoom = s.activeRoom; lastWave = wave; lastProgress = Date.now();
      console.log(`autopilot: room ${s.activeRoom}, phase ${s.activePhase}, wave ${wave}, cleared ${s.clearedMask.toString(16)}`);
    }
    expect(Date.now() - lastProgress, `autopilot progresses: room ${s.activeRoom}, ${s.activePhase}, wave ${wave}, at ${s.self.x},${s.self.y}`).toBeLessThan(90_000);
    if (s.activePhase === 'combat') { seen.add(s.activeRoom); await page.keyboard.press('KeyK'); }
    await page.waitForTimeout(500);
  }
  expect(seen.has(floor.boss)).toBe(true);
  for (let i = 0; i < def.rooms.length; i++) {
    if (def.rooms[i].kind === 'combat') expect((latestMask >>> i) & 1, `combat room ${i} cleared`).toBe(1);
  }
  await page.waitForFunction(() => window.__heavenfall.screen === 'results', null, { timeout: 10_000 });
  expect((await state(page)).gameResult).toBe('victory');
});
