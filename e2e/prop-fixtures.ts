/** Shoot a real prop through accepted mouse input; never mutate simulation state. */
import type { Page } from '@playwright/test';
import { expect, state } from './fixtures';
import { PROP_HEIGHT } from '../src/data/props';

const cursors = new WeakMap<Page, { x: number; y: number }>();

export async function shootProp(page: Page, id: number, beforeShotPath?: string): Promise<void> {
  const q = (await state(page)).props.find((p) => p.id === id)!;
  const cursor = cursors.get(page) ?? { x: Math.floor(page.viewportSize()!.width / 2), y: Math.floor(page.viewportSize()!.height / 2) };
  if (!await page.evaluate(() => document.pointerLockElement !== null)) await page.mouse.click(cursor.x, cursor.y);
  await page.waitForFunction(() => document.pointerLockElement !== null);
  const own = (await state(page)).self;
  let yaw = Math.atan2(q.y - own.y, q.x - own.x) - own.yaw;
  while (yaw > Math.PI) yaw -= 2 * Math.PI;
  while (yaw < -Math.PI) yaw += 2 * Math.PI;
  const height = PROP_HEIGHT[q.family === 'blast' ? 'blast' : q.family === 'blessing' ? 'blessing' : 'loot'] * 0.85;
  const pitch = Math.atan2(q.z + height - own.z - 1.6, Math.hypot(q.x - own.x, q.y - own.y)) - own.pitch;
  cursor.x += Math.round(yaw / 0.0022);
  cursor.y -= Math.round(pitch / 0.0022);
  await page.mouse.move(cursor.x, cursor.y, { steps: 4 });
  cursors.set(page, cursor);
  if (beforeShotPath) await page.screenshot({ path: beforeShotPath });
  await page.mouse.down();
  try { await expect.poll(async () => (await state(page)).brokenProps.includes(id), { timeout: 10_000 }).toBe(true); }
  finally { await page.mouse.up(); }
}
