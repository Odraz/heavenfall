import { expect, state, test } from './fixtures';

/** The fixture's four pillars (map=watchman, the Choir Loft's nave): cell rects [x0, x1) × [y0, y1). */
const PILLARS = [[9, 13, 20, 24], [21, 25, 20, 24], [7, 9, 28, 32], [25, 27, 28, 32]];
/** A floor point in the open nave. */
const OPEN = { x: 16.5, y: 27.5 };

test('a Watchman shot costs a player in the open 12 HP after its thread and sparks harmlessly on a pillar', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?dev=1&map=watchman&class=betrayer&seed=7');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  await page.evaluate(({ x, y }) => window.__heavenfallTeleport!(x, y), OPEN);
  // Wave 1 has no Watchmen: clear it with the dev key until the director starts wave 2.
  await page.evaluate(async () => {
    const t0 = performance.now();
    while ((window.__heavenfall.director?.wave ?? -1) < 1) {
      if (performance.now() - t0 > 60_000) throw new Error('wave 2 never started');
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }));
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  await page.screenshot({ path: test.info().outputPath('watchman-wave2.png') });
  // Keep the Blessed away (dev key J) and stand in the open; when a Watchman starts an aim at us with
  // time left, step behind the pillar that blocks it, then return after its shot.
  const run = await page.evaluate(async ({ pillars, open }) => {
    const s = window.__heavenfall, shots = new Map<string, { slot: number; fireTick: number; x: number; y: number; z: number; covered: boolean; before: number; after?: number }>();
    let cover: { slot: number; fireTick: number } | null = null, lastJ = 0, hp0 = s.players[0].hp, screenshotAt = -1;
    const t0 = performance.now();
    const blocks = (wx: number, wy: number, px: number, py: number, [x0, x1, y0, y1]: number[]) => {
      // Segment against the rect, slightly shrunk (slab test).
      let t0 = 0, t1 = 1;
      for (const [o, d, lo, hi] of [[wx, px - wx, x0 + 0.05, x1 - 0.05], [wy, py - wy, y0 + 0.05, y1 - 0.05]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
        let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
      }
      return true;
    };
    const coverFor = (wx: number, wy: number) => {
      let best: { x: number; y: number } | null = null, bestD = Infinity;
      for (const p of pillars) {
        const cx = (p[0] + p[1]) / 2, cy = (p[2] + p[3]) / 2, d = Math.hypot(cx - wx, cy - wy);
        const r = Math.hypot(p[1] - p[0], p[3] - p[2]) / 2 + 0.9, x = cx + (cx - wx) / d * r, y = cy + (cy - wy) / d * r;
        if (x < 1.6 || x > 32.4 || y < 18.6 || y > 37.4) continue;
        if (pillars.some(([x0, x1, y0, y1]) => x > x0 - 0.6 && x < x1 + 0.6 && y > y0 - 0.6 && y < y1 + 0.6)) continue;
        if (!blocks(wx, wy, x, y, p)) continue;
        const dd = Math.hypot(x - s.self.x, y - s.self.y);
        if (dd < bestD) { bestD = dd; best = { x, y }; }
      }
      return best;
    };
    while (performance.now() - t0 < 90_000) {
      const now = performance.now();
      if (now - lastJ > 200) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })); lastJ = now; }
      const tick = s.lastSnapshotTick, hp = s.players[0].hp;
      for (const a of s.watchmen) {
        if (a.targetId !== 0) continue;
        const key = `${a.slot}:${a.incarnation}:${a.shot}`;
        if (a.phase === 'aim' && !cover && a.fireTick - tick >= 15 && ![...shots.values()].some((v) => v.covered)) {
          const w = s.watchmanBodies.find((b) => b.slot === a.slot && b.incarnation === a.incarnation);
          const at = w && coverFor(w.x, w.y);
          if (at) { cover = { slot: a.slot, fireTick: a.fireTick }; window.__heavenfallTeleport!(at.x, at.y); }
        }
        if (a.phase === 'fired' && !shots.has(key)) {
          const covered = cover?.slot === a.slot && cover.fireTick === a.fireTick;
          shots.set(key, { slot: a.slot, fireTick: a.fireTick, x: a.x, y: a.y, z: a.z, covered, before: hp0 });
          if (covered) { cover = null; screenshotAt = now + 30; }
        }
      }
      for (const v of shots.values()) if (v.after === undefined && tick >= v.fireTick + 3) v.after = hp;
      if (screenshotAt > 0 && now > screenshotAt) { screenshotAt = -1; window.__heavenfallTeleport!(open.x, open.y); }
      hp0 = hp;
      const done = [...shots.values()].filter((v) => v.after !== undefined);
      if (done.some((v) => v.covered) && done.some((v) => !v.covered && Math.hypot(v.x - s.self.x, v.y - s.self.y) < 0.6)) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { shots: [...shots.values()], self: { ...s.self }, hp: s.players[0].hp };
  }, { pillars: PILLARS, open: OPEN });
  await page.screenshot({ path: test.info().outputPath('watchman-after.png') });
  const settled = run.shots.filter((v) => v.after !== undefined);
  const covered = settled.find((v) => v.covered);
  expect(covered, JSON.stringify(run)).toBeDefined();
  // Behind the pillar: the shot ended on it, short of the player, and cost nothing.
  expect(covered!.before - covered!.after!).toBeLessThanOrEqual(0);
  const hit = settled.find((v) => !v.covered && Math.hypot(v.x - OPEN.x, v.y - OPEN.y) < 0.6);
  expect(hit, JSON.stringify(run)).toBeDefined();
  // In the open: exactly one shot's damage (solo sustain may add under 1 HP between samples).
  expect(hit!.before - hit!.after!).toBeGreaterThanOrEqual(11);
  expect(hit!.before - hit!.after!).toBeLessThanOrEqual(13);
  expect((await state(page)).gameResult).toBeNull();
});
