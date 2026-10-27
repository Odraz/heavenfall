/**
 * The rogue benchmark workloads (R9 stage 4) as a smoke: each page reaches a BENCH line carrying every
 * field, on the pinned seed's crest room, its Refiner's Fire room and the Gate. No timing threshold:
 * software rendering here measures nothing; `npm run bench -- --map rogue` does, when asked.
 */
import type { Page } from '@playwright/test';
import { PINNED } from '../src/gen/pinned';
import { expect, state, test } from './fixtures';

const FIELDS = ['fps', 'fpsLow', 'frameMs', 'simMs', 'simMsMax', 'stats', 'slow', 'slowGapMs', 'seed', 'genMs', 'mapBuildMs', 'loadMs'];

async function bench(page: Page, query: string): Promise<Record<string, unknown>> {
  const line = new Promise<string>((resolve) => page.on('console', (m) => { if (m.text().startsWith('BENCH ')) resolve(m.text()); }));
  await page.goto(`/?bench=1&map=rogue&${query}`);
  const r = JSON.parse((await line).slice('BENCH '.length)) as Record<string, unknown>;
  for (const f of FIELDS) expect(r[f], f).not.toBeUndefined();
  expect(r.seed).toBe(PINNED.seed);
  for (const f of ['genMs', 'mapBuildMs', 'loadMs']) expect(r[f] as number, f).toBeGreaterThan(0);
  return r;
}

for (const [label, query, room] of [['the crest room', 'room=3', 3], ['the Refiner\'s Fire room', 'room=1', 1], ['the Gate', 'view=gate', 10]] as const) {
  test(`the rogue benchmark reaches a complete BENCH line in ${label}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 640, height: 360 });
    const r = bench(page, query);
    await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.activePhase === 'combat', null, { timeout: 60_000 });
    const s = await state(page);
    expect(s.activeRoom).toBe(room);
    if (room === 1) await page.waitForFunction(() => window.__heavenfall.hazards.activeCells > 0, null, { timeout: 30_000 });
    console.info(`bench ${label}: ${JSON.stringify(await r)}`);
  });
}
