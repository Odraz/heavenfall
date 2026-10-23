import { expect, state, test } from './fixtures';

/**
 * The netcode stage (2026-10-22): a bot guest on a simulated bad connection (160 ms round trip, ±25 ms
 * jitter, 2% of snapshots and inputs lost) fights a crowd over real PeerJS. Its kill markers must come
 * true on the host (lag compensation and click latching), and both F3s must report the connection.
 */
test('a guest with 160 ms of lag sees its kill markers confirmed and its connection reported', async ({ page: a, browser }) => {
  test.setTimeout(180_000);
  const owned = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await owned.newContext({ viewport: { width: 480, height: 270 }, baseURL: 'http://localhost:4173' });
  const b = await context.newPage(), errors: string[] = [];
  b.on('pageerror', (e) => errors.push(e.message)); b.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await a.setViewportSize({ width: 480, height: 270 });
    for (const [p, name, url] of [[a, 'Alice', '/?dev=1&menu=1&map=crest&god=1'], [b, 'Bob', '/?dev=1&menu=1&bot=1&lag=160&jitter=25&loss=2']] as const) {
      await p.goto(url); await p.getByLabel('Player name').fill(name); await p.getByRole('button', { name: 'Multiplayer', exact: true }).click();
    }
    await a.getByRole('button', { name: 'Host game', exact: true }).click(); await a.getByRole('button', { name: 'Create', exact: true }).click();
    await a.waitForFunction(() => window.__heavenfall.screen === 'lobby'); const id = (await a.locator('.game-id').textContent())!.trim();
    await b.getByRole('button', { name: 'Join game', exact: true }).click(); await b.getByLabel('Game ID').fill(id); await b.getByRole('button', { name: 'Join', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
    await a.getByRole('button', { name: /The Fallen/ }).click(); await b.getByRole('button', { name: /The Betrayer/ }).click();
    await a.getByRole('button', { name: 'Start', exact: true }).click();
    await Promise.all([a, b].map((p) => p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 })));
    await Promise.all([a, b].map((p) => p.evaluate(() => window.__heavenfallTeleport!(14.5, 9.5))));
    await a.waitForFunction(() => window.__heavenfall.activePhase === 'combat', null, { timeout: 30_000 });

    // The bot shoots for 30 s at the crowd it sees, 160 ms and the render delay behind the host.
    await b.waitForFunction(() => window.__heavenfall.killMarkers.confirmed + window.__heavenfall.killMarkers.missed >= 40, null, { timeout: 60_000 });
    await b.waitForTimeout(10_000);
    const s = await state(b), host = await state(a);
    const settled = s.killMarkers.confirmed + s.killMarkers.missed;
    console.log(`lag: rtt ${s.link.rttMs?.toFixed(0)} ms (${s.link.route}), view delay ${s.link.delayMs.toFixed(0)} ms, jitter ${s.link.jitterMs.toFixed(0)} ms, ` +
      `kill markers ${s.killMarkers.confirmed}/${settled} confirmed, ${s.killMarkers.revealed} predicted deaths reappeared, host lines ${JSON.stringify(host.link.lines)}`);
    expect(s.link.rttMs).toBeGreaterThanOrEqual(150);
    expect(s.link.rttMs).toBeLessThan(450);
    expect(s.link.route).toBe('direct');
    expect(s.link.delayMs).toBeGreaterThanOrEqual(150);
    expect(s.killMarkers.confirmed / settled).toBeGreaterThanOrEqual(0.9);
    // Predicted kills die on the guest's screen at once; few come back because the host disagreed.
    expect(s.killMarkers.revealed / s.killMarkers.predicted).toBeLessThanOrEqual(0.1);
    const guest = host.players.find((p) => p.id === 1)!;
    expect(guest.kills).toBeGreaterThan(0);
    expect(host.link.lines).toHaveLength(1);
    expect(host.link.lines[0]).toMatch(/^P1 ping \d+ ms \(direct\)$/);

    await a.keyboard.press('Escape'); await a.getByRole('button', { name: 'Leave game', exact: true }).click();
    await b.waitForFunction(() => window.__heavenfall.screen === 'title', null, { timeout: 10_000 }); expect(errors).toEqual([]);
  } finally { await owned.close(); }
});
