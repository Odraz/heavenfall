/**
 * R8 presentation: close-ups of the art integrated in R8 in the production client, and the cue census of
 * a bot-played crest and Gatekeeper fight (docs/rogue/r08.md stage 5). Screenshots and the census JSON go
 * to the test output; the census asserts that no warning cue was refused a voice.
 */
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { generateFloor } from '../src/gen';
import { PINNED } from '../src/gen/pinned';
import { PEARLY_POOL } from '../src/data/rooms/1';
import { expect, state, test } from './fixtures';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
const BOSS = 10;
const CREST = 3;
const base = `/?dev=1&map=rogue&seed=${PINNED.seed}`;
const inGame = (page: Page) => page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 3, null, { timeout: 30_000 });
const deg = (r: number) => (r * 180) / Math.PI;
/** Warnings of incoming damage (PRIO_WARNING): the mixer must never refuse them a voice. */
const WARNINGS = ['judgmentPrewarn', 'judgmentCharge', 'tollTell', 'tollPersonalWhoosh', 'callTell', 'volleyWindup', 'dominionTell', 'watchmanAim', 'cantorTell', 'carrierMark', 'bossDefeat'];

test('R8 art in the production client: the stall, the Confessional and the Watchers', async ({ page }) => {
  test.setTimeout(420_000);
  // The Pardoner behind his alms box: four views of the room's center from 7 m away, 2 m up.
  const rect = g.map.rooms[g.floor.pardoner].rect, rx = (rect.x0 + rect.x1 + 1) / 2, ry = (rect.y0 + rect.y1 + 1) / 2;
  for (const [i, a] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) {
    await page.goto(`${base}&room=${g.floor.pardoner}&class=fallen&god=1&cam=${rx + Math.cos(a) * 7},${ry + Math.sin(a) * 7},,${deg(a + Math.PI)},-10`);
    await inGame(page); await page.waitForTimeout(1500);
    await page.screenshot({ path: test.info().outputPath(`pardoner-${i}.png`) });
  }

  // The wall face beside the Advocate's point (src/client/advocate.ts advocateMount).
  const [ac, ar] = g.map.rooms[g.floor.confessional].points!.advocate!;
  const [wx, wy] = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).find(([dx, dy]) => g.map.wall[(ar + dy) * g.map.w + ac + dx])!;
  const m = { x: ac + 0.5 + wx * 0.5, y: ar + 0.5 + wy * 0.5, nx: -wx, ny: -wy };
  await page.goto(`${base}&room=${g.floor.confessional}&class=fallen&god=1&cam=${m.x + m.nx * 3.5},${m.y + m.ny * 3.5},,${deg(Math.atan2(-m.ny, -m.nx))},4`);
  await inGame(page); await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath('confessional.png') });

  // The Watchers in the first cycle under the Edict of the Trumpet: the nearest one, from 3.5 m away.
  await page.goto(`${base}&room=${BOSS}&class=heretic&god=1&edicts=5`);
  await inGame(page);
  await page.waitForFunction(() => (window.__heavenfall.boss?.eyes ?? 0) > 0, null, { timeout: 60_000 });
  const s0 = await state(page), [ex, ey, ez] = s0.boss!.eyesAt.reduce((a, b) => Math.hypot(a[0] - s0.self.x, a[1] - s0.self.y) <= Math.hypot(b[0] - s0.self.x, b[1] - s0.self.y) ? a : b);
  await page.screenshot({ path: test.info().outputPath('watchers-opening.png') });
  await page.waitForTimeout(2500);
  const dx = s0.self.x - ex, dy = s0.self.y - ey, dl = Math.hypot(dx, dy) || 1;
  await page.goto(`${base}&room=${BOSS}&class=heretic&god=1&edicts=5&cam=${ex + dx / dl * 3.5},${ey + dy / dl * 3.5},${ez - 1},${deg(Math.atan2(-dy, -dx))},16`);
  await inGame(page);
  await page.waitForFunction(() => (window.__heavenfall.boss?.eyes ?? 0) > 0 && (window.__heavenfall.boss!.flags & 2) !== 0, null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: test.info().outputPath('watcher-close.png') });
});

test('cue census: a bot-played crest and Gatekeeper fight; no warning loses its voice', async ({ page }) => {
  test.setTimeout(600_000);
  const census: Record<string, unknown> = {};
  const take = async (label: string, seconds: number) => {
    const s = await state(page);
    census[label] = { seconds, cues: s.cues, started: s.voices.started, refused: s.voices.refused };
  };
  // The crest room: earlier waves removed with K, the crest itself fought by the Binder bot (chain gun, 12 shots a second).
  await page.goto(`${base}&room=${CREST}&class=binder&bot=1&god=1`);
  await inGame(page);
  await page.waitForFunction(() => window.__heavenfall.activePhase === 'combat', null, { timeout: 30_000 });
  for (;;) {
    if ((await state(page)).crests > 0) break;
    await page.keyboard.press('KeyK'); await page.waitForTimeout(250);
  }
  const t0 = Date.now();
  await page.waitForFunction((room) => ((window.__heavenfall.clearedMask >>> room) & 1) === 1, CREST, { timeout: 240_000 });
  await take('crest', (Date.now() - t0) / 1000);
  // The Gatekeeper with the bot until he falls or four minutes pass.
  await page.goto(`${base}&room=${BOSS}&class=binder&bot=1&god=1`);
  await inGame(page);
  const t1 = Date.now();
  await page.waitForFunction(() => window.__heavenfall.gameResult !== null, null, { timeout: 240_000 }).catch(() => undefined);
  await take('gatekeeper', (Date.now() - t1) / 1000);
  writeFileSync(test.info().outputPath('cue-census.json'), JSON.stringify(census, null, 2));
  console.info(JSON.stringify(census));
  for (const [label, c] of Object.entries(census) as Array<[string, { refused: Record<string, number> }]>) {
    for (const w of WARNINGS) expect(c.refused[w] ?? 0, `${label}: ${w} refused`).toBe(0);
  }
});

test('the trumpet and phase 2 (R9 B5): bosshp=0.52, a bot-played census from the transition on', async ({ page }) => {
  test.setTimeout(420_000);
  // A disposable fight that starts at 52%: the bot's first hits bring him to half and the trumpet.
  await page.goto(`${base}&room=${BOSS}&class=binder&bot=1&god=1&bosshp=0.52`);
  await inGame(page);
  const t0 = Date.now();
  await page.waitForFunction(() => ((window.__heavenfall.boss?.phase ?? 0) & 3) === 2, null, { timeout: 180_000 });
  const transition = (Date.now() - t0) / 1000;
  await page.waitForTimeout(600);
  await page.screenshot({ path: test.info().outputPath('trumpet.png') });
  const before = await state(page);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: test.info().outputPath('phase2.png') });
  const t1 = Date.now();
  await page.waitForFunction(() => window.__heavenfall.gameResult !== null, null, { timeout: 180_000 }).catch(() => undefined);
  const s = await state(page);
  const census = { transitionAfter: transition, phase2Seconds: (Date.now() - t1) / 1000 + 6, result: s.gameResult, cuesAtTransition: before.cues, cues: s.cues, started: s.voices.started, refused: s.voices.refused };
  writeFileSync(test.info().outputPath('phase2-census.json'), JSON.stringify(census, null, 2));
  console.info(JSON.stringify(census));
  expect(before.cues.bossTransition ?? 0).toBeGreaterThanOrEqual(1);
  for (const w of WARNINGS) expect(s.voices.refused[w] ?? 0, `phase 2: ${w} refused`).toBe(0);
});
