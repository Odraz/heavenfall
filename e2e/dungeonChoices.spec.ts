// Overlay buttons are clicked by dispatch: Playwright's hit test inside the game root's fixed overlays reports
// the wrong element below the panels' first rows (a real browser's hit test finds the button; see r06-report.md).
/** R6: relics on the HUD, the Advocate's view and bargain, the key, a Bell, the Sundial, Edicts and Pilgrim's Return in the production client. */
import { generateFloor } from '../src/gen';
import { PINNED } from '../src/gen/pinned';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { expect, state, test } from './fixtures';
import type { Page } from '@playwright/test';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
const url = (room: number, extra = '') => `/?dev=1&map=rogue&seed=${PINNED.seed}&room=${room}&class=fallen&god=1${extra}`;
const ready = (page: Page) => page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 3);
const teleport = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => window.__heavenfallTeleport!(x, y), [x, y]);
/** Dev key K until the room's waves are gone and it clears. */
async function clearRoom(page: Page, room: number): Promise<void> {
  await page.waitForFunction(() => window.__heavenfall.activePhase === 'combat', null, { timeout: 30_000 });
  await expect.poll(async () => {
    await page.keyboard.press('KeyK');
    return ((await state(page)).clearedMask >>> room) & 1;
  }, { timeout: 60_000, intervals: [400] }).toBe(1);
}

test('two relics of a pair show on the HUD as their combo; the Advocate equips and offers the bargain', async ({ page }) => {
  await page.goto(url(g.floor.confessional, '&relics=usher,unbroken'));
  await ready(page);
  await expect(page.locator('.relic-strip')).toBeVisible();
  await expect(page.locator('.relic-combo')).toHaveText('Order of Expulsion');
  expect((await state(page)).relics.combo).toBe('expulsion');
  const [ax, ay] = g.def.rooms[g.floor.confessional].points!.advocate!;
  await teleport(page, ax + 0.5, ay + 0.5);
  const hub = page.locator('.advocate-panel');
  await page.keyboard.press('KeyF');
  await expect(hub).toBeVisible();
  // The host's body arrives at its movement limit; the Advocate's view opens on the client at once.
  await page.waitForTimeout(3000);
  await expect(hub.locator('.advocate-row')).toHaveCount(4);
  await hub.getByRole('button', { name: /^Relics/ }).dispatchEvent('click');
  const relics = page.locator('.relic-panel');
  await expect(relics.locator('.relic-cell')).toHaveCount(12);
  await expect(relics.locator('.relic-equip-combo')).toHaveText('Combo: Order of Expulsion');
  await page.screenshot({ path: test.info().outputPath('relics-view.png') });
  // Unequip slot 2 and apply: the combo ends.
  await relics.locator('.relic-equip-slot[data-slot="1"]').dispatchEvent('click');
  await expect(relics.locator('.relic-equip-combo')).toHaveText('');
  await relics.getByRole('button', { name: 'Apply', exact: true }).dispatchEvent('click');
  await page.waitForFunction(() => window.__heavenfall.relics.combo === null);
  await expect(page.locator('.relic-combo')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyF');
  await page.locator('.advocate-panel').getByRole('button', { name: /^The bargain/ }).dispatchEvent('click');
  const bargain = page.locator('.rite-panel');
  await expect(bargain.locator('.talent-title')).toHaveText('The Advocate’s bargain');
  await expect(bargain.locator('.relic-offer-card')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('bargain.png') });
  await bargain.getByRole('button', { name: 'Decline', exact: true }).dispatchEvent('click');
  await expect(bargain).toBeHidden();
  await page.keyboard.press('KeyF');
  await expect(page.locator('.advocate-panel').getByRole('button', { name: /^The bargain/ })).toBeDisabled();
});

test('the key lies in the key room once it clears; touching it puts the holder under the minimap', async ({ page }) => {
  await page.goto(url(g.floor.keyRoom));
  await ready(page);
  await expect(page.locator('.sundial-line')).toContainText('Sundial · 13:');
  await clearRoom(page, g.floor.keyRoom);
  const [rx, ry] = g.def.rooms[g.floor.keyRoom].points!.reward!;
  await teleport(page, rx + 2, ry + 2);
  await page.waitForFunction(() => window.__heavenfall.route?.keyHolder === 0, null, { timeout: 10_000 });
  await expect(page.locator('.key-line')).toContainText('Key · Dev');
});

test('a Bell hangs after its room clears; F under it rings the Judgment countdown', async ({ page }) => {
  const room = g.floor.bells[0];
  await page.goto(url(room));
  await ready(page);
  await clearRoom(page, room);
  await page.waitForFunction(() => window.__heavenfall.route?.bells.includes('available'));
  const [rx, ry] = g.def.rooms[room].points!.reward!;
  await teleport(page, rx + 2.6, ry + 2);
  await expect(page.locator('.shop-hint')).toContainText('Bell of Judgment');
  // The host's body follows a dev teleport at its movement limit: F until the host agrees it stands there.
  await expect.poll(async () => {
    await page.keyboard.press('KeyF');
    return (await state(page)).route?.bells.includes('pending');
  }, { timeout: 20_000, intervals: [700] }).toBe(true);
  await page.waitForFunction(() => window.__heavenfall.activePhase === 'countdown' || window.__heavenfall.activePhase === 'combat');
});

test('Edicts set the Sentence shown under the XP bar', async ({ page }) => {
  await page.goto(url(g.floor.pardoner, '&edicts=1,2,3'));
  await ready(page);
  await expect(page.locator('.xp-sentence')).toHaveText('Sentence 3 · XP ×1.45');
  expect((await state(page)).sentence).toBe(3);
});

test("Pilgrim's Return: hold M, click a cleared room on the map, stand still, arrive there", async ({ page }) => {
  await page.goto(url(g.floor.pardoner));
  await ready(page);
  const breach = g.def.rooms.findIndex((r) => r.kind === 'breach');
  await page.keyboard.down('KeyM');
  const plate = page.getByLabel('Full floor map');
  await expect(plate).toBeVisible();
  const box = (await plate.boundingBox())!, r = g.floor.rooms[breach];
  const sx = Math.min(...r.slots.map((s) => s[0])), sy = Math.min(...r.slots.map((s) => s[1]));
  const scale = box.width / 588;
  await page.mouse.move(box.x + (sx * 84 + 42) * scale, box.y + (sy * 84 + 42) * scale);
  await page.mouse.down(); await page.mouse.up();
  const roomOf = (x: number, y: number) => g.map.roomOf[Math.floor(y) * g.map.w + Math.floor(x)];
  await expect.poll(async () => { const s = (await state(page)).self; return roomOf(s.x, s.y); }, { timeout: 8000 }).toBe(breach);
  await page.keyboard.up('KeyM');
});
