/** R4: learning in the Lobby, the saved build entering a run, dev quick builds, the Talents view and a Rite. */
import { expect, test } from './fixtures';
import { createProfile } from '../src/profile/model';
import { exportCode } from '../src/profile/codec';

test('a build learned in the Lobby is saved and enters the run', async ({ page }) => {
  const p = createProfile('Talent pilot', 'f'.repeat(32), 1); p.characters.betrayer.xp = 4000;
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Import code', exact: true }).click();
  await page.getByLabel('Import code').fill(await exportCode(p, true));
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Profile imported', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Singleplayer', exact: true }).click();
  // The Talents button has its own row under Q and E; every card keeps the same height.
  const betrayer = page.locator('.class-card[data-class-id="betrayer"]');
  const powers = await betrayer.locator('.class-abilities').boundingBox(), talents = await betrayer.locator('.class-talents').boundingBox();
  expect(talents!.y).toBeGreaterThanOrEqual(powers!.y + powers!.height);
  const heights = await page.locator('.class-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
  await page.getByRole('button', { name: 'Talents · 2 to learn', exact: true }).click();
  const panel = page.locator('.talent-panel');
  await expect(panel.locator('.talent-points')).toHaveText('0 / 2 points');
  await panel.getByRole('button', { name: 'The Nail', exact: true }).click();
  await panel.getByRole('button', { name: 'Glancing Silver', exact: true }).click();
  // A third point isn't there: the view says so instead of learning it.
  await panel.getByRole('button', { name: 'Recoil', exact: true }).click();
  await expect(panel.locator('.talent-message')).toHaveText('Not enough talent points');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel.locator('.talent-message')).toHaveText('Saved');
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('heavenfall.profile.1')!).characters.betrayer.talents);
  expect(saved).toEqual(['betrayer.c.1a', 'betrayer.a.1a']);
  await page.locator('.class-card[data-class-id="betrayer"]').click({ position: { x: 20, y: 20 } });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 3);
  // The hint window (H) keeps abilities and carried items only; talents are read in the T view.
  await page.keyboard.press('KeyH');
  const hints = page.locator('.hints');
  await expect(hints).toBeVisible();
  await expect(hints.locator('.hint-section')).toHaveText(['Carried']);
  await expect(hints).toContainText('Nothing carried. Buy items from the Pardoner or pick them up.');
  for (const gone of ['Glancing Silver', 'The Nail', '1 / 2:', 'F: buy', 'Esc:', 'T: read']) await expect(hints).not.toContainText(gone);
  await page.keyboard.press('KeyH');
  await expect(hints).toBeHidden();
  // T opens the build to read anywhere: nothing to apply or click, and singleplayer waits until T closes it.
  await page.keyboard.press('KeyT');
  const view = page.locator('.talent-panel');
  await expect(view.locator('.talent-title')).toHaveText('Talents');
  await expect(view.locator('.talent-points')).toHaveText('2 / 2 points');
  await expect(view.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0);
  await expect(view.locator('.talent-reset')).toHaveCount(3);
  await expect(view.locator('.talent-reset').first()).toBeHidden();
  await expect(view.getByRole('button', { name: 'Glancing Silver', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await view.getByRole('button', { name: 'The Nail', exact: true }).click();
  await expect(view.getByRole('button', { name: 'The Nail', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await view.getByRole('button', { name: 'Recoil', exact: true }).hover();
  await expect(page.locator('.tooltip')).toContainText('Recoil');
  const held = await page.evaluate(() => window.__heavenfall.lastSnapshotTick);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__heavenfall.lastSnapshotTick)).toBe(held);
  await page.keyboard.press('KeyT');
  await expect(view).toHaveCount(0);
  await expect(page.locator('.pause-overlay')).toBeHidden();
  await page.waitForFunction((t) => window.__heavenfall.lastSnapshotTick > t + 5, held);
});

test('a dev quick build, the free Talents view and a Rite offer', async ({ page }) => {
  await page.goto('/?dev=1&map=rogue&class=betrayer&build=saboteur&seed=317434499&god=1');
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 3);
  expect(await page.locator('.ability-icon').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).alt))).toEqual(['Field of Blood', 'Silver Wire']);
  await page.keyboard.press('KeyT');
  await expect(page.locator('.talent-panel .talent-points')).toHaveText('9 points · free (development)');
  await page.keyboard.press('Escape');
  await expect(page.locator('.talent-panel')).toHaveCount(0);
  await expect(page.locator('.pause-overlay')).toBeHidden();
  await page.keyboard.press('KeyR');
  const rite = page.locator('.rite-panel');
  await expect(rite).toBeVisible();
  const first = rite.locator('.rite-card').first();
  const name = await first.locator('.rite-name').textContent();
  await first.getByRole('button', { name: 'Take', exact: true }).click();
  await expect(rite).toBeHidden();
  // The taken Rite shows in the T view, held and not editable.
  await page.keyboard.press('KeyT');
  await expect(page.locator('.talent-panel').getByRole('button', { name: name!, exact: true })).toHaveClass(/\brite\b/);
  await page.keyboard.press('Escape');
});
