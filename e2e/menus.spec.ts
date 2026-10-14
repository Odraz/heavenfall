import { expect, state, test } from './fixtures';
import type { Page } from '@playwright/test';

async function settingsFit(page: Page) {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 640, height: 360 }]) {
    await page.setViewportSize(viewport);
    const back = page.getByRole('button', { name: 'Back', exact: true });
    await back.scrollIntoViewIfNeeded();
    await expect(back).toBeInViewport();
    const fits = await page.locator('.settings-view:visible').evaluate(view => {
      const panel = view.parentElement!, box = panel.getBoundingClientRect(), style = getComputedStyle(panel);
      const top = box.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
      const bottom = box.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom);
      return [...view.querySelectorAll('button, input')].every(control => {
        const rect = control.getBoundingClientRect();
        return rect.top >= top - 1 && rect.bottom <= bottom + 1;
      });
    });
    expect(fits).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

// From milestone 5: Title, Singleplayer Setup, Loading and Pause through the real UI (§13.2).
test('menus', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'title');

  await page.getByRole('textbox', { name: 'Player name' }).fill('Tester');
  await page.getByRole('button', { name: 'Singleplayer' }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'singleplayerSetup');
  await expect(page.getByRole('button', { name: /Practice/ })).toHaveCount(0);
  await page.getByRole('button', { name: /The Fallen/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  const first = await state(page);
  expect(first.floorHash).toMatch(/^[0-9a-f]{8}$/);
  expect(first.runId).toMatch(/^[0-9a-f]{32}$/);
  expect(first.activePhase).toBe('idle');
  expect(first.enemies).toBe(0);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(async () => (await state(page)).paused).toBe(false);

  // From M8: Pause has the volume sliders in its Settings view, and a value changed there is still set on Title.
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  await expect(page.getByRole('slider', { name: 'Music' })).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  await settingsFit(page);
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toHaveCount(0);
  for (const name of ['Master', 'Music', 'SFX']) await expect(page.getByRole('slider', { name })).toBeVisible();
  await page.getByRole('slider', { name: 'Music' }).fill('23');
  await expect(page.getByRole('button', { name: 'Leave game' })).toBeHidden();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('slider', { name: 'Music' })).toBeHidden();
  await page.getByRole('button', { name: 'Leave game' }).click();
  await expect.poll(async () => (await state(page)).screen).toBe('title');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('slider', { name: 'Music' })).toHaveValue('23');
  await settingsFit(page);
  expect((await state(page)).runId).toBeNull();
  expect((await state(page)).floorHash).toBeNull();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Singleplayer' }).click();
  await page.getByRole('button', { name: /The Binder/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => window.__heavenfall.screen === 'inGame', null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 0);
  const second = await state(page);
  expect(second.runId).toMatch(/^[0-9a-f]{32}$/);
  expect(second.runId).not.toBe(first.runId);
  expect(second.floorHash).toMatch(/^[0-9a-f]{8}$/);
  expect(second.players[0].classId).toBe('binder');
});
