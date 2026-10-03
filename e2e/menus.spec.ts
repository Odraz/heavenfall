import { expect, state, test } from './fixtures';

// From milestone 5: Title, Singleplayer Setup, Loading and Pause through the real UI (§13.2).
test('menus', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'title');

  await page.getByLabel('Player name').fill('Tester');
  await page.getByRole('button', { name: 'Singleplayer' }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'singleplayerSetup');
  await page.getByRole('button', { name: /The Fallen/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 });

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(async () => (await state(page)).paused).toBe(false);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await page.getByRole('button', { name: 'Leave game' }).click();
  await expect.poll(async () => (await state(page)).screen).toBe('title');
});
