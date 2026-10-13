import { expect, state, test } from './fixtures';

test('real PeerJS compressed crest snapshots publish complete advancing crowds at the original cadence and upload limit', async ({ page: a, browser }) => {
  test.setTimeout(180_000);
  const owned = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await owned.newContext({ viewport: { width: 320, height: 180 }, baseURL: 'http://localhost:4173' });
  const b = await context.newPage(), errors: string[] = [];
  b.on('pageerror', (e) => errors.push(e.message)); b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await b.addInitScript(() => {
      const Native = window.DecompressionStream;
      (window as unknown as { __r2Decodes: number }).__r2Decodes = 0;
      window.DecompressionStream = class extends Native {
        constructor(format: CompressionFormat) { super(format); (window as unknown as { __r2Decodes: number }).__r2Decodes++; }
      };
    });
    await a.setViewportSize({ width: 320, height: 180 });
    for (const [p, name, url] of [[a, 'Alice', '/?dev=1&menu=1&map=crest&god=1'], [b, 'Bob', '/?dev=1&menu=1']] as const) {
      await p.goto(url); await p.getByLabel('Player name').fill(name); await p.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    }
    await a.getByRole('button', { name: 'Host game', exact: true }).click(); await a.getByRole('button', { name: 'Create', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'lobby'); const id = (await a.locator('.game-id').textContent())!.trim();
    await b.getByRole('button', { name: 'Join game', exact: true }).click(); await b.getByLabel('Game ID').fill(id); await b.getByRole('button', { name: 'Join', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'lobby');
    await a.getByRole('button', { name: /The Fallen/ }).click(); await b.getByRole('button', { name: /The Binder/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await Promise.all([a, b].map((p) => p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 })));
    await Promise.all([a, b].map((p) => p.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5))));
    await a.waitForFunction(() => window.__heavenfall.activePhase === 'combat');
    while ((await state(a)).crests === 0) { await a.keyboard.press('KeyK'); await a.waitForTimeout(250); }
    await b.waitForFunction(() => window.__heavenfall.enemies >= 700, null, { timeout: 15_000 });
    expect(await b.evaluate(() => (window as unknown as { __r2Decodes: number }).__r2Decodes)).toBeGreaterThan(0);
    let tick = (await state(b)).lastSnapshotTick;
    for (let i = 0; i < 30; i++) {
      await a.waitForTimeout(1000);
      await b.waitForFunction((t) => window.__heavenfall.lastSnapshotTick > t, tick, { timeout: 3000 });
      const s = await state(b), host = await state(a); tick = s.lastSnapshotTick;
      expect(host.enemyCountsByTick[tick]).toBe(s.enemies); expect(s.runId).toBe(host.runId); expect(host.netOutKBps).toBeLessThanOrEqual(437);
    }
    await a.screenshot({ path: test.info().outputPath('compressed-native-crest.png') });
    await a.keyboard.press('Escape'); await a.getByRole('button', { name: 'Leave game', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'title', null, { timeout: 6000 }); expect(errors).toEqual([]);
  } finally { await owned.close(); }
});
