import type { Browser, Page } from '@playwright/test';
import { expect, state, test } from './fixtures';

/**
 * A client page in its own browser, failing the test on console and page errors like `page`. Smaller
 * than A's, so four software-rendered games on one machine block each other less. Its own browser has
 * its own GPU process: in one browser every page's WebGL shares one software renderer, and three games
 * loading at once took 17–22 s, past the host's 20 s limit, and D, sharing A's, starved and timed out
 * (M12 stage 4).
 */
async function clientPage(browser: Browser, errors: string[], label: string): Promise<Page> {
  const own = await browser.browserType().launch(test.info().project.use.launchOptions ?? {});
  const context = await own.newContext({ viewport: { width: 800, height: 450 } });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${label} console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${label} page error: ${e.message}`));
  return page;
}

async function toMultiplayer(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'title');
  await page.getByLabel('Player name').fill(name);
  await page.getByRole('button', { name: 'Multiplayer' }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'multiplayer');
}

async function join(page: Page, gameId: string, password: string): Promise<void> {
  await page.getByLabel('Game ID').fill(gameId);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
}

// From milestone 7: four players through the real menus over the public PeerJS server (§13.2); from
// M8 the fourth joins the game in progress from an invite link, and B chats (M8 §12.2).
test('multiplayer', async ({ page: a, browser }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const [b, c, d] = await Promise.all(['B', 'C', 'D'].map((l) => clientPage(browser, errors, l)));
  const clients = [b, c, d];

  // (1) A hosts with password `pw` and reads the game ID.
  await toMultiplayer(a, '/?bot=1&god=1', 'Alice');
  await a.getByRole('button', { name: 'Host game' }).click();
  await a.getByLabel('Password').fill('pw');
  await a.getByRole('button', { name: 'Create' }).click();
  await a.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
  const gameId = (await a.locator('.game-id').textContent())!.trim();
  expect(gameId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // (2) B joins with password `x` and sees `Wrong password`, then joins with `pw`; C joins.
  await toMultiplayer(b, '/?bot=1', 'Bob');
  await b.getByRole('button', { name: 'Join game' }).click();
  await join(b, gameId.toLowerCase(), 'x');
  await expect(b.getByText('Wrong password')).toBeVisible({ timeout: 30_000 });
  await join(b, gameId, 'pw');
  await b.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
  await toMultiplayer(c, '/?bot=1', 'Cleo');
  await c.getByRole('button', { name: 'Join game' }).click();
  await join(c, gameId, 'pw');
  await c.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });

  // (3) A picks the Fallen; on B's screen the Fallen becomes greyed out and shows A's name.
  await a.getByRole('button', { name: /The Fallen/ }).click();
  const fallenOnB = b.getByRole('button', { name: /The Fallen/ });
  await expect(fallenOnB).toBeDisabled();
  await expect(fallenOnB).toContainText('Alice');
  await b.getByRole('button', { name: /The Heretic Saint/ }).click();
  await c.getByRole('button', { name: /The Binder/ }).click();
  const start = a.getByRole('button', { name: 'Start' });
  await expect(start).toBeEnabled();
  // B clicks its class again: the pick clears, the Heretic is free on A's screen and Start waits.
  const hereticOnB = b.getByRole('button', { name: /The Heretic Saint/ });
  await hereticOnB.click();
  await expect(a.getByRole('button', { name: /The Heretic Saint/ })).toBeEnabled();
  await expect(start).toBeDisabled();
  await hereticOnB.click();
  await expect(start).toBeEnabled();
  await start.click();

  // (4) Everyone reaches inGame within 30 s, and A's arenaPhase becomes combat within 60 s.
  await Promise.all([a, b, c].map((p) => p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 })));
  await a.waitForFunction(() => window.__heavenfall.arenaPhase === 'combat', null, { timeout: 60_000 });

  // D joins the game in progress from an invite link, and picks the Betrayer (M8 §12.2). Until the
  // chat check, the three running games are drawn small: software rendering them at full size starves
  // D's Loading past the 20 s timeout.
  const sizes = await Promise.all([a, b, c].map((p) => p.viewportSize()!));
  await Promise.all([a, b, c].map((p) => p.setViewportSize({ width: 320, height: 180 })));
  // B's and C's browsers render at full speed beside D's Loading, so their pages run at an eighth of the
  // CPU until D is in (A, the host, isn't slowed).
  const throttles = await Promise.all([b, c].map((p) => p.context().newCDPSession(p)));
  await Promise.all(throttles.map((t) => t.send('Emulation.setCPUThrottlingRate', { rate: 8 })));
  await d.goto(`/?join=${gameId}&bot=1`);
  await d.waitForFunction(() => window.__heavenfall?.screen === 'title');
  await d.getByLabel('Player name').fill('Dan');
  await d.getByRole('button', { name: `Join game ${gameId}` }).click();
  await d.waitForFunction(() => window.__heavenfall.screen === 'join');
  await expect(d.getByLabel('Game ID')).toHaveValue(gameId);
  await expect(d.getByLabel('Password')).toBeFocused();
  await d.getByLabel('Password').fill('pw');
  await d.getByRole('button', { name: 'Join', exact: true }).click();
  await d.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
  await expect(d.getByRole('button', { name: /The Fallen/ })).toBeDisabled();
  await d.getByRole('button', { name: /The Betrayer/ }).click();
  const enter = d.getByRole('button', { name: 'Enter game' });
  await expect(enter).toBeEnabled();
  await enter.click();
  // A's players include D. A is read the moment D appears, since the bots revive a soul within a
  // second or two: if A's arena was in combat when D entered, D entered as a soul.
  const atGo = (await (
    await a.waitForFunction(
      () => {
        const s = window.__heavenfall;
        const p = s.players.find((q) => q.id === 3);
        return p ? { arenaPhase: s.arenaPhase, ...p } : null;
      },
      null,
      { polling: 50, timeout: 30_000 },
    )
  ).jsonValue())!;
  expect(atGo.classId).toBe('betrayer');
  if (atGo.arenaPhase === 'combat') {
    expect(atGo.dead).toBe(true);
    expect(typeof atGo.revive).toBe('number');
  }
  await d.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 });
  await Promise.all(throttles.map((t) => t.send('Emulation.setCPUThrottlingRate', { rate: 1 })));
  await a.waitForFunction(() => window.__heavenfall.players.some((p) => p.id === 3));
  // B chats: Enter opens the chat line, Enter sends; every page has the message within 3 s (M8 §7).
  // Still drawn small, so a starved page doesn't miss the 3 s.
  await b.keyboard.press('Enter');
  await expect(b.locator('.chat-input')).toBeFocused();
  await b.keyboard.type('Rise, brothers!');
  await b.keyboard.press('Enter');
  // Polled on a timer: a software-rendered page draws too few frames for the default per-frame polling.
  await Promise.all(
    [a, ...clients].map((p) =>
      p.waitForFunction(() => window.__heavenfall.chat.some((m) => m.playerId === 1 && m.text === 'Rise, brothers!'), null, { timeout: 3_000, polling: 100 }),
    ),
  );
  await expect(a.locator('.chat-message')).toContainText('Bob: Rise, brothers!');

  await Promise.all([a, b, c].map((p, i) => p.setViewportSize(sizes[i])));

  // (5) For 30 s, sampled every 1 s: every client's snapshots advance, each client's enemy count at its
  // newest tick equals A's at the same tick, and A's upload stays within budget.
  // A keeps only its last 90 ticks (3 s); a client page that was frozen for longer by software
  // rendering is read again, up to 3 s more, until A still has its newest tick to compare with. So is a
  // client whose snapshots haven't advanced yet: four games in three browsers' software renderers
  // freeze a page for over a second now and then (M12 stage 4).
  let prev = await Promise.all(clients.map(async (p) => (await state(p)).lastSnapshotTick));
  for (let i = 0; i < 30; i++) {
    await a.waitForTimeout(1000);
    const ticks = await Promise.all(
      clients.map(async (p, k) => {
        for (let attempt = 0; ; attempt++) {
          const s = await state(p);
          const as = await state(a);
          const aTicks = Object.keys(as.enemyCountsByTick).map(Number);
          const behind = !(s.lastSnapshotTick in as.enemyCountsByTick) && s.lastSnapshotTick < Math.min(...aTicks);
          if ((behind || s.lastSnapshotTick <= prev[k]) && attempt < 15) {
            await p.waitForTimeout(200);
            continue;
          }
          const where = `client ${k + 1} at tick ${s.lastSnapshotTick}; A has ticks ${Math.min(...aTicks)}–${Math.max(...aTicks)}`;
          expect(s.lastSnapshotTick, `client ${k + 1} snapshots advance`).toBeGreaterThan(prev[k]);
          expect(as.enemyCountsByTick[s.lastSnapshotTick], `enemies of ${where}`).toBe(s.enemyCountsByTick[s.lastSnapshotTick]);
          return s.lastSnapshotTick;
        }
      }),
    );
    expect((await state(a)).netOutKBps).toBeLessThanOrEqual(437);
    prev = ticks;
  }

  // (6) A leaves: every client returns to Title with `Host left the game` within 6 s.
  await a.keyboard.press('Escape');
  await expect.poll(async () => (await state(a)).paused).toBe(true);
  await a.getByRole('button', { name: 'Leave game' }).click();
  await Promise.all(
    clients.map(async (p) => {
      await p.waitForFunction(() => window.__heavenfall.screen === 'title', null, { timeout: 6_000 });
      await expect(p.locator('.message')).toHaveText('Host left the game');
    }),
  );
  expect(errors).toEqual([]);
  await Promise.all(clients.map((p) => p.context().browser()?.close()));
});
