import { expect, test } from './fixtures';
import { createProfile } from '../src/profile/model';
import { exportCode } from '../src/profile/codec';
import type { Page } from '@playwright/test';

test('profile import, lock exclusion, durable solo stake and abandoned recovery', async ({ page, context }) => {
  const p = createProfile('Disposable', 'd'.repeat(32), 1); p.inventory[0] = { item: 'balm', count: 3 };
  const code = await exportCode(p, true);
  await page.goto('/'); await page.getByLabel('Import code').fill(code); await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Profile imported', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const other = await context.newPage(); await other.goto('/'); await other.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(other.getByText('Open in another tab', { exact: true })).toBeVisible(); await other.close();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await page.getByRole('button', { name: /The Fallen/ }).click(); await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
  expect(saved.inventory).toEqual([null, null]); expect(saved.run.carried[0].count).toBe(3);
  expect(saved.run.admissionCommitted).toBe(true); expect(saved.stats.runs).toBe(1);
  // Reload destroys the sole host. Starting another run resolves the unmatched stake as loss.
  await page.reload(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await page.getByRole('button', { name: /The Binder/ }).click(); await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
  expect(next.run.runId).not.toBe(saved.run.runId); expect(next.run.carried).toEqual([null, null]); expect(next.stats.runs).toBe(2);
});

test('a refused durable stake never places a player or spends the stored carry', async ({ page }) => {
  const p = createProfile('Quota fixture', 'e'.repeat(32), 1); p.inventory[0] = { item: 'seal', count: 2 };
  await page.goto('/'); await page.getByLabel('Import code').fill(await exportCode(p, true)); await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'heavenfall.profile.1') throw new DOMException('Quota fixture', 'QuotaExceededError'); original.call(this, key, value); };
  });
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click(); await page.getByRole('button', { name: /The Fallen/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText(/Progress is in memory/)).toBeVisible();
  expect(await page.evaluate(() => window.__heavenfall.lastSnapshotTick)).toBe(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
  expect(saved.run).toBeNull(); expect(saved.inventory[0].count).toBe(2); expect(saved.stats.runs).toBe(0);
});

test('development gameplay does not touch a stored profile', async ({ page }) => {
  const p = createProfile('Keep me', 'f'.repeat(32), 1); p.inventory[0] = { item: 'balm', count: 3 };
  await page.goto('/'); await page.evaluate(profile => localStorage.setItem('heavenfall.profile.1', JSON.stringify(profile)), p);
  await page.goto('/?dev=1&map=sandbox&class=fallen&god=1'); await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  await page.keyboard.press('KeyK');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!))).toEqual(p);
});

test('a persistent guest reconnects to one retained admission and host exit restores only the original carry', async ({ page: host, browser }) => {
  const guestContext = await browser.newContext();
  const prepare = async (page: Page, name: string, id: string): Promise<void> => {
    const p = createProfile(name, id.repeat(32), 1); p.inventory[0] = { item: 'feather', count: 2 };
    await page.goto('/'); await page.getByLabel('Import code').fill(await exportCode(p, true));
    await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Multiplayer', exact: true }).click();
  };
  try {
    let guest = await guestContext.newPage();
    await prepare(host, 'Host fixture', '1'); await prepare(guest, 'Guest fixture', '2');
    await host.getByRole('button', { name: 'Host game', exact: true }).click(); await host.getByRole('button', { name: 'Create', exact: true }).click();
    await host.waitForFunction(() => window.__heavenfall.screen === 'lobby');
    const gameId = (await host.locator('.game-id').textContent())!.trim();
    const join = async (): Promise<void> => {
      await guest.getByRole('button', { name: 'Join game', exact: true }).click(); await guest.getByLabel('Game ID').fill(gameId);
      await guest.getByRole('button', { name: 'Join', exact: true }).click(); await guest.waitForFunction(() => window.__heavenfall.screen === 'lobby');
    };
    await join(); await host.getByRole('button', { name: /The Fallen/ }).click(); await guest.getByRole('button', { name: /The Binder/ }).click();
    await host.getByRole('button', { name: 'Start', exact: true }).click(); await guest.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
    await expect(guest.getByLabel('Item 1: Pilgrim’s Feather ×2', { exact: true })).toBeVisible();
    await guest.keyboard.press('Digit1');
    await expect(guest.getByLabel('Item 1: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
    const first = await guest.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
    await guest.close();
    await host.waitForFunction(() => window.__heavenfall.players.length === 1);
    guest = await guestContext.newPage(); await guest.goto('/'); await guest.getByRole('button', { name: 'Continue', exact: true }).click();
    await guest.getByRole('button', { name: 'Multiplayer', exact: true }).click(); await join();
    await guest.getByRole('button', { name: 'Enter game', exact: true }).click(); await guest.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
    const resumed = await guest.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
    expect(resumed.run.runId).toBe(first.run.runId); expect(resumed.run.admissionId).toBe(first.run.admissionId); expect(resumed.stats.runs).toBe(1);
    await expect(guest.getByLabel('Item 1: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
    await host.keyboard.press('Escape'); await host.getByRole('button', { name: 'Leave game', exact: true }).click();
    await expect(guest.getByText('Host left the game', { exact: true })).toBeVisible();
    const ended = await guest.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
    expect(ended.run).toBeNull(); expect(ended.inventory[0]).toEqual({ item: 'feather', count: 2 }); expect(ended.stats.runs).toBe(1);
  } finally { await guestContext.close(); }
});

test('both carried keys respect refused use and cooldown while practice leaves the imported profile untouched', async ({ page }) => {
  const profile = createProfile('Item practice', '3'.repeat(32), 1);
  profile.inventory = [{ item: 'balm', count: 2 }, { item: 'feather', count: 3 }];
  await page.goto('/'); await page.getByLabel('Import code').fill(await exportCode(profile, true));
  await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'));
  await page.getByRole('button', { name: 'Practice (disposable)', exact: true }).click();
  await page.getByRole('button', { name: /The Fallen/ }).click(); await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByLabel('Item 1: Balm of the Rejected ×2', { exact: true })).toBeVisible();
  await page.keyboard.press('Digit1'); await page.keyboard.press('Digit2');
  await expect(page.getByLabel('Item 2: Pilgrim’s Feather ×2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Item 1: Balm of the Rejected ×2', { exact: true })).toBeVisible();
  await page.keyboard.press('Digit2'); await page.waitForTimeout(1200);
  await expect(page.getByLabel('Item 2: Pilgrim’s Feather ×2', { exact: true })).toBeVisible();
  await page.keyboard.press('Digit2'); await expect(page.getByLabel('Item 2: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'))).toBe(saved);
  await page.screenshot({ path: test.info().outputPath('r03-item-hud.png') });
});
