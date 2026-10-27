import { expect, state, test } from './fixtures';

/** Reports the real driver used for diagnostic runs; it changes no game/rendering behavior. */
test('native production WebGL reports its renderer and advances accepted snapshots', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/?dev=1&map=arrival&class=fallen&seed=7');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame' && window.__heavenfall.lastSnapshotTick > 0);
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector<HTMLCanvasElement>('.game-canvas')!.getContext('webgl2')!;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  });
  expect(renderer).toBeTruthy(); console.log(`WebGL renderer: ${renderer}`);
  const tick = (await state(page)).lastSnapshotTick;
  await page.waitForFunction((t) => window.__heavenfall.lastSnapshotTick > t, tick);
  await test.info().attach('renderer', { body: renderer, contentType: 'text/plain' });
});
