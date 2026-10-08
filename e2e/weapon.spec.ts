import { expect, test } from './fixtures';

// M11 §3.7, §6: the painted weapon, its muzzle flash and the swing sit under every other HUD element,
// and the ability slots stay where they were (right 24 px, bottom 50 px, 64 px apart by 12 px).
for (const classId of ['fallen', 'heretic', 'binder', 'betrayer']) {
  test(`painted weapon under the HUD: ${classId}`, async ({ page }) => {
    await page.goto(`/?dev=1&map=sandbox&class=${classId}&god=1&seed=1`);
    await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });
    const r = await page.evaluate(() => {
      const hud = document.querySelector('.hud')!;
      const kids = [...hud.children];
      const z = (sel: string) => Number(getComputedStyle(document.querySelector(sel)!).zIndex);
      const at = (sel: string) => kids.indexOf(document.querySelector(sel)!);
      const low = ['.weapon', '.muzzle-flash', ...(document.querySelector('.weapon-swing') ? ['.weapon-swing'] : [])];
      const high = ['.abilities', '.hud-left', '.crosshair'];
      const slots = [...document.querySelectorAll('.ability')].map((e) => e.getBoundingClientRect());
      const layers = [...document.querySelectorAll<HTMLImageElement>('.weapon img')];
      return {
        z: low.flatMap((l) => high.map((h) => [l, h, z(l), z(h), at(l), at(h)] as const)),
        slots: slots.map((s) => [s.left, s.top, s.width, s.height]),
        w: window.innerWidth,
        h: window.innerHeight,
        loaded: layers.length > 0 && layers.every((i) => i.complete && i.naturalWidth > 0),
      };
    });
    for (const [l, h, zl, zh, il, ih] of r.z) {
      expect(zl, `${l} under ${h}`).toBeLessThan(zh);
      expect(il, `${l} before ${h} in the DOM`).toBeLessThan(ih);
    }
    expect(r.slots).toEqual([
      [r.w - 24 - 64 - 12 - 64, r.h - 50 - 64, 64, 64],
      [r.w - 24 - 64, r.h - 50 - 64, 64, 64],
    ]);
    expect(r.loaded).toBe(true);
  });
}
