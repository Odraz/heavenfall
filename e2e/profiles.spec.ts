import { expect, test } from './fixtures';
import { createProfile } from '../src/profile/model';
import { exportCode, importCode } from '../src/profile/codec';
import type { Page } from '@playwright/test';

test('accepted progress remains exportable when storage fails and retry saves current memory', async ({ page, context }) => {
  const p = createProfile('Save retry', '9'.repeat(32), 1); p.inventory[0] = { item: 'feather', count: 2 };
  await page.goto('/'); await openProfile(page); await openImport(page); await page.getByLabel('Import code').fill(await exportCode(p, true));
  await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(page.getByText('Profile imported', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click(); await page.getByRole('button', { name: /The Fallen/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // Admission's first input establishes the counter baseline before a new key edge is sent.
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 3);
  await expect(page.getByLabel('Item 1: Pilgrim’s Feather ×2', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, '__restoreStorage', { value: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = function(key, value) { if (key === 'heavenfall.profile.1') throw new DOMException('Quota fixture', 'QuotaExceededError'); original.call(this, key, value); };
  });
  await page.keyboard.press('Digit1'); await expect(page.getByLabel('Item 1: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
  const alert = page.getByRole('alert'); await expect(alert).toContainText('Progress is in memory');
  await page.keyboard.press('Escape');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']); await alert.getByRole('button', { name: 'Copy save code' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^MG1\./);
  const exported = await importCode(await page.evaluate(() => navigator.clipboard.readText()));
  expect(exported.codex.itemsTried).toContain('feather');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!).codex.itemsTried)).not.toContain('feather');
  await page.evaluate(() => (window as unknown as { __restoreStorage(): void }).__restoreStorage());
  await alert.getByRole('button', { name: 'Retry save' }).click(); await expect(alert).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!).codex.itemsTried)).toContain('feather');
});

test('profile import, lock exclusion, durable solo stake and abandoned recovery', async ({ page, context }) => {
  const p = createProfile('Disposable', 'd'.repeat(32), 1); p.inventory[0] = { item: 'balm', count: 3 };
  const code = await exportCode(p, true);
  await page.goto('/'); await openProfile(page); await openImport(page); await page.getByLabel('Import code').fill(code); await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(page.getByText('Profile imported', { exact: true })).toBeVisible();
  await expect(page.getByText('Profile imported', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const other = await context.newPage(); await other.goto('/'); await other.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await expect(other.getByText('Open in another tab', { exact: true })).toBeVisible(); await other.close();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await page.getByRole('button', { name: /The Fallen/ }).click(); await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
  expect(saved.inventory).toEqual([null, null]); expect(saved.run.carried[0].count).toBe(3);
  expect(saved.run.admissionCommitted).toBe(true); expect(saved.stats.runs).toBe(1);
  // Reload destroys the sole host. Starting another run resolves the unmatched stake as loss.
  await page.reload();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await page.getByRole('button', { name: /The Binder/ }).click(); await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
  expect(next.run.runId).not.toBe(saved.run.runId); expect(next.run.carried).toEqual([null, null]); expect(next.stats.runs).toBe(2);
});

test('a refused durable stake never places a player or spends the stored carry', async ({ page }) => {
  const p = createProfile('Quota fixture', 'e'.repeat(32), 1); p.inventory[0] = { item: 'seal', count: 2 };
  await page.goto('/'); await openProfile(page); await openImport(page); await page.getByLabel('Import code').fill(await exportCode(p, true)); await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(page.getByText('Profile imported', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'heavenfall.profile.1') throw new DOMException('Quota fixture', 'QuotaExceededError'); original.call(this, key, value); };
  });
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click(); await page.getByRole('button', { name: /The Fallen/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // A refused start returns to the title and says why, instead of waiting on Loading forever.
  await page.waitForFunction(() => window.__heavenfall.screen === 'title');
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
  await guestContext.addInitScript(() => {
    const channels: RTCDataChannel[] = [], create = RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel = function(label, options) { const channel = create.call(this, label, options); channels.push(channel); return channel; };
    Object.defineProperty(window, '__disconnectGuest', { value: () => channels.forEach(c => c.close()) });
  });
  const prepare = async (page: Page, name: string, id: string): Promise<void> => {
    const p = createProfile(name, id.repeat(32), 1); p.inventory[0] = { item: 'feather', count: 2 };
    await page.goto('/'); await openProfile(page); await openImport(page); await page.getByLabel('Import code').fill(await exportCode(p, true));
    await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(page.getByText('Profile imported', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Back', exact: true }).click();
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
    guest = await guestContext.newPage(); await guest.goto('/');
    await guest.getByRole('button', { name: 'Multiplayer', exact: true }).click(); await join();
    await guest.getByRole('button', { name: 'Enter game', exact: true }).click(); await guest.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
    const resumed = await guest.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
    expect(resumed.run.runId).toBe(first.run.runId); expect(resumed.run.admissionId).toBe(first.run.admissionId); expect(resumed.stats.runs).toBe(1);
    await expect(guest.getByLabel('Item 1: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
    await guest.evaluate(() => (window as unknown as { __disconnectGuest(): void }).__disconnectGuest());
    await expect(guest.getByText('Connection lost; reconnect to recover the attempt', { exact: true })).toBeVisible();
    const interrupted = await guest.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
    expect(interrupted.run.runId).toBe(first.run.runId); expect(interrupted.inventory).toEqual([null, null]);
    await host.waitForFunction(() => window.__heavenfall.players.length === 1);
    await guest.getByRole('button', { name: 'Multiplayer', exact: true }).click(); await join();
    await guest.getByRole('button', { name: 'Enter game', exact: true }).click(); await guest.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
    await expect(guest.getByLabel('Item 1: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
    await host.keyboard.press('Escape'); await host.getByRole('button', { name: 'Leave game', exact: true }).click();
    await expect(guest.getByText('Host left the game', { exact: true })).toBeVisible();
    const ended = await guest.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
    expect(ended.run).toBeNull(); expect(ended.inventory[0]).toEqual({ item: 'feather', count: 2 }); expect(ended.stats.runs).toBe(1);
  } finally { await guestContext.close(); }
});

test('both carried keys respect refused use and cooldown in a normal run from an imported disposable profile', async ({ page }) => {
  const profile = createProfile('Item keys', '3'.repeat(32), 1);
  profile.inventory = [{ item: 'balm', count: 2 }, { item: 'feather', count: 3 }];
  await page.goto('/'); await openProfile(page); await openImport(page); await page.getByLabel('Import code').fill(await exportCode(profile, true));
  await page.getByRole('button', { name: 'Import', exact: true }).click(); await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(page.getByText('Profile imported', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await expect(page.locator('.class-level')).toHaveCount(4);
  // Carried items use the in-game round slots, each item's rule and the stated risk; no relic line yet.
  await expect(page.locator('.profile-loadout .loadout-name')).toHaveText(['Balm of the Rejected ×2', 'Pilgrim’s Feather ×3']);
  await expect(page.locator('.profile-loadout .item-slot:not(.empty)')).toHaveCount(2);
  await expect(page.getByText('Carried items are lost if you die before the Gatekeeper falls.', { exact: true })).toBeVisible();
  await expect(page.getByText(/relics/i)).toHaveCount(0);
  const cards = await page.locator('.class-cards').boundingBox(), loadout = await page.locator('.profile-loadout').boundingBox(), dungeon = await page.locator('.dungeon-picker').boundingBox();
  expect(loadout!.y).toBeGreaterThanOrEqual(cards!.y + cards!.height);
  expect(dungeon!.y).toBeGreaterThan(loadout!.y + loadout!.height);
  const weapon = await page.locator('.class-card').first().locator('.class-weapon').last().boundingBox(), powers = await page.locator('.class-card').first().locator('.class-abilities').boundingBox();
  expect(powers!.y).toBeGreaterThanOrEqual(weapon!.y + weapon!.height);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({ path: test.info().outputPath('r03-class-selection.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: /The Fallen/ }).click(); await page.getByRole('button', { name: 'Start', exact: true }).click();
  // Admission's first input establishes the counter baseline before a new key edge is sent.
  await page.waitForFunction(() => window.__heavenfall.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 3, null, { timeout: 30_000 });
  await expect(page.getByLabel('Item 1: Balm of the Rejected ×2', { exact: true })).toBeVisible();
  const inventory = await page.locator('.item-slot').first().boundingBox(), abilities = await page.locator('.ability:not(.item-slot)').first().boundingBox();
  expect(inventory!.y + inventory!.height).toBeLessThan(abilities!.y);
  const wallet = await page.locator('.halo-wallet').boundingBox(), xp = await page.getByRole('progressbar', { name: 'Class experience' }).boundingBox();
  expect(wallet!.y).toBeLessThan(60); expect(xp!.y).toBeLessThan(60); expect(wallet!.x + wallet!.width).toBeLessThan(xp!.x);
  // Full health is green; the halo counter shows the in-world halo sprite.
  await expect(page.locator('.hp-fill')).toHaveAttribute('data-tier', 'ok');
  await expect(page.locator('.halo-wallet .halo-icon')).toHaveAttribute('src', /gold-halo/);
  await expect(page.getByRole('progressbar', { name: 'Class experience' })).toHaveAttribute('aria-valuetext', /^Level 1, /);
  // The hint window describes both carried stacks (audit batch 3).
  await page.keyboard.press('KeyH');
  await expect(page.getByText('1 · Balm of the Rejected ×2: heal yourself for 40 HP.', { exact: true })).toBeVisible();
  await expect(page.getByText('2 · Pilgrim’s Feather ×3: move 2 m/s faster for 8 seconds.', { exact: true })).toBeVisible();
  await page.keyboard.press('KeyH');
  await page.keyboard.press('Digit1'); await page.keyboard.press('Digit2');
  await expect(page.getByLabel('Item 2: Pilgrim’s Feather ×2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Item 1: Balm of the Rejected ×2', { exact: true })).toBeVisible();
  await page.keyboard.press('Digit2'); await page.waitForTimeout(1200);
  await expect(page.getByLabel('Item 2: Pilgrim’s Feather ×2', { exact: true })).toBeVisible();
  await page.keyboard.press('Digit2'); await expect(page.getByLabel('Item 2: Pilgrim’s Feather ×1', { exact: true })).toBeVisible();
  // The durable stake holds the imported carry; spent charges are only at risk inside the run.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!));
  expect(saved.inventory).toEqual([null, null]);
  expect(saved.run.carried).toEqual([{ item: 'balm', count: 2 }, { item: 'feather', count: 3 }]);
  await page.screenshot({ path: test.info().outputPath('r03-item-hud.png') });
});

async function panelBox(page: Page): Promise<number[]> {
  return page.locator('.panel:visible').first().evaluate(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
}

/** The Import view replaces the Profile view at the same panel size. */
async function openImport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Import code', exact: true }).click();
  await expect(page.getByLabel('Import code')).toBeVisible();
}

async function openProfile(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
}

test('title has one editable name and profile Settings safely imports and clears one current save', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Player name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: /Continue|New|Change profile|Download|Upload/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Player name' }).fill('Tester');
  await page.screenshot({ path: test.info().outputPath('r03-title.png') });
  // Menu panels never grow or move when a view or message opens (audit A2, A3).
  const title = await panelBox(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  expect(await panelBox(page)).toEqual(title);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  const profile = await panelBox(page);
  const saved = await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'));
  await expect(page.locator('.profile-class')).toHaveCount(4);
  await openImport(page);
  expect(await panelBox(page)).toEqual(profile);
  await page.getByLabel('Import code').fill('broken'); await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('.profile-view:visible .message')).not.toBeEmpty();
  expect(await panelBox(page)).toEqual(profile);
  expect(await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'))).toBe(saved);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^MG1\./);
  const p = createProfile('Imported', '7'.repeat(32), 1); p.characters.fallen.xp = 1200;
  await openImport(page); await page.getByLabel('Import code').fill(await exportCode(p, true));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'))).toBe(saved);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Profile imported', { exact: true })).toBeVisible();
  await expect(page.getByText('Level 1 · 1200 / 1500', { exact: true })).toBeVisible();
  expect(await panelBox(page)).toEqual(profile);
  await page.screenshot({ path: test.info().outputPath('r03-profile.png') });
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click();
  expect(await panelBox(page)).toEqual(profile);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!).characters.fallen.xp)).toBe(1200);
  await page.getByRole('button', { name: 'Confirm clear', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!).characters.fallen.xp)).toBe(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Player name' })).toHaveValue('Imported');
  await page.getByRole('textbox', { name: 'Player name' }).fill('Renamed');
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!).name)).toBe('Renamed');
});

test('unreadable progress is preserved until confirmed recovery from title Settings', async ({ page }) => {
  const original = JSON.stringify({ ...createProfile('Future', '8'.repeat(32), 1), schema: 2 });
  await page.goto('/');
  await page.evaluate(raw => localStorage.setItem('heavenfall.profile.1', raw), original);
  await page.reload();
  await page.getByLabel('Player name').fill('Recovery');
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await expect(page.locator('.message')).toContainText('newer version');
  await openProfile(page);
  await expect(page.getByRole('button', { name: 'Copy original data', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'))).toBe(original);
  await openProfile(page);
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('heavenfall.profile.1'))).toBe(original);
  await page.getByRole('button', { name: 'Confirm clear', exact: true }).click();
  await expect(page.getByText('Profile cleared', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1.recovery')!))).toEqual([original, null]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  await expect(page.getByText('Choose your class', { exact: true })).toBeVisible();
});
