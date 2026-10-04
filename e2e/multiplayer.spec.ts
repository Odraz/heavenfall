import type { Browser, Page } from '@playwright/test';
import { expect, state, test } from './fixtures';

/**
 * A client page in its own browser context, failing the test on console and page errors like `page`.
 * Smaller than A's, so four software-rendered games on one machine block each other less.
 */
async function clientPage(browser: Browser, errors: string[], label: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 800, height: 450 } });
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

// From milestone 7: four players through the real menus over the public PeerJS server (§13.2).
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

  // (2) B joins with password `x` and sees `Wrong password`, then joins with `pw`; C and D join.
  await toMultiplayer(b, '/?bot=1', 'Bob');
  await b.getByRole('button', { name: 'Join game' }).click();
  await join(b, gameId.toLowerCase(), 'x');
  await expect(b.getByText('Wrong password')).toBeVisible({ timeout: 30_000 });
  await join(b, gameId, 'pw');
  await b.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
  for (const [page, name] of [
    [c, 'Cleo'],
    [d, 'Dan'],
  ] as const) {
    await toMultiplayer(page, '/?bot=1', name);
    await page.getByRole('button', { name: 'Join game' }).click();
    await join(page, gameId, 'pw');
    await page.waitForFunction(() => window.__heavenfall.screen === 'lobby', null, { timeout: 30_000 });
  }

  // (3) A picks the Fallen; on B's screen the Fallen becomes greyed out and shows A's name.
  await a.getByRole('button', { name: /The Fallen/ }).click();
  const fallenOnB = b.getByRole('button', { name: /The Fallen/ });
  await expect(fallenOnB).toBeDisabled();
  await expect(fallenOnB).toContainText('Alice');
  await b.getByRole('button', { name: /The Heretic Saint/ }).click();
  await c.getByRole('button', { name: /The Binder/ }).click();
  await d.getByRole('button', { name: /The Betrayer/ }).click();
  const start = a.getByRole('button', { name: 'Start' });
  await expect(start).toBeEnabled();
  await start.click();

  // (4) Everyone reaches inGame within 30 s, and A's arenaPhase becomes combat within 60 s.
  await Promise.all([a, ...clients].map((p) => p.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 })));
  await a.waitForFunction(() => window.__heavenfall.arenaPhase === 'combat', null, { timeout: 60_000 });

  // (5) For 30 s, sampled every 1 s: every client's snapshots advance, each client's enemy count at its
  // newest tick equals A's at the same tick, and A's upload stays within budget.
  // A keeps only its last 90 ticks (3 s); a client page that was frozen for longer by software
  // rendering is read again, up to 3 s more, until A still has its newest tick to compare with.
  let prev = await Promise.all(clients.map(async (p) => (await state(p)).lastSnapshotTick));
  for (let i = 0; i < 30; i++) {
    await a.waitForTimeout(1000);
    const ticks = await Promise.all(
      clients.map(async (p, k) => {
        for (let attempt = 0; ; attempt++) {
          const s = await state(p);
          const as = await state(a);
          const aTicks = Object.keys(as.enemyCountsByTick).map(Number);
          if (!(s.lastSnapshotTick in as.enemyCountsByTick) && s.lastSnapshotTick < Math.min(...aTicks) && attempt < 15) {
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
});
