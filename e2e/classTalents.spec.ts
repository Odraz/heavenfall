/** R5: the Fallen, Heretic Saint and Binder quick builds in the production client: kits, trees, a Rite and a networked effect each. */
import { expect, test } from './fixtures';

const base = (cls: string, build: string) => `/?dev=1&map=rogue&class=${cls}&build=${build}&seed=317434499&god=1`;
const icons = (page: import('@playwright/test').Page) => page.locator('.ability-icon').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).alt));

test('the Fallen firewalker: Rain of Fire on E, three trees of icons, Blasphemer\'s Ring sets the floor burning', async ({ page }) => {
  await page.goto(base('fallen', 'firewalker'));
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 3);
  expect(await icons(page)).toEqual(['Blasphemy', 'Rain of Fire']);
  await page.keyboard.press('KeyT');
  const view = page.locator('.talent-panel');
  await expect(view.locator('.talent-points')).toHaveText('9 points · free (development)');
  expect(await view.locator('.talent-node img.talent-icon').count()).toBe(21);
  for (const tree of ['The Walls of Dis', 'The Burning Sand', 'The War in Heaven']) await expect(view).toContainText(tree);
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);
  // The host's fire reaches the client as burning cells.
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__heavenfall.talentFire > 30);
  // It goes out after its 5 s.
  await page.waitForFunction(() => window.__heavenfall.talentFire < 5, null, { timeout: 12000 });
});

test('the Heretic martyr: Cloud of Witnesses on Q makes a worn cloud area, and a Rite offer opens', async ({ page }) => {
  await page.goto(base('heretic', 'martyr'));
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 3);
  expect(await icons(page)).toEqual(['Cloud of Witnesses', "Martyr's Shroud"]);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__heavenfall.talentAreas.includes('cloud'));
  await page.keyboard.press('KeyR');
  const rite = page.locator('.rite-panel');
  await expect(rite).toBeVisible();
  await expect(rite.locator('.rite-card').first()).toBeVisible();
  await rite.getByRole('button', { name: 'Pass', exact: true }).click();
  await expect(rite).toBeHidden();
});

test('the Binder warden: the Boundary Chain on Q lays its chain; a Rite card can be taken', async ({ page }) => {
  await page.goto(base('binder', 'warden'));
  await page.waitForFunction(() => window.__heavenfall.lastSnapshotTick > 3);
  expect(await icons(page)).toEqual(['The Boundary Chain', 'Discord']);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__heavenfall.talentAreas.includes('boundary'));
  await page.keyboard.press('KeyR');
  const rite = page.locator('.rite-panel');
  await expect(rite).toBeVisible();
  const card = rite.locator('.rite-card').filter({ has: page.getByRole('button', { name: 'Take', exact: true, disabled: false }) }).first();
  const name = await card.locator('.rite-name').textContent();
  await card.getByRole('button', { name: 'Take', exact: true }).click();
  await expect(rite).toBeHidden();
  await page.keyboard.press('KeyT');
  await expect(page.locator('.talent-panel').getByRole('button', { name: name!, exact: true })).toHaveClass(/\brite\b/);
  await page.keyboard.press('Escape');
});
