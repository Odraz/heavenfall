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

  // From M8: Pause has the volume sliders in its Settings view, and a value changed there is still set on Title.
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await expect(page.getByRole('slider', { name: 'Music' })).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  for (const name of ['Master', 'Music', 'SFX']) await expect(page.getByRole('slider', { name })).toBeVisible();
  await page.getByRole('slider', { name: 'Music' }).fill('23');
  await expect(page.getByRole('button', { name: 'Leave game' })).toBeHidden();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('slider', { name: 'Music' })).toBeHidden();
  await page.getByRole('button', { name: 'Leave game' }).click();
  await expect.poll(async () => (await state(page)).screen).toBe('title');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('slider', { name: 'Music' })).toHaveValue('23');
});
