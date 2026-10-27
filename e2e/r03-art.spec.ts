import { readdir } from 'node:fs/promises';
import { expect, test } from './fixtures';

test('shipped R03 sprites have transparent surrounds on light and dark surfaces', async ({ page }) => {
  const files = (await readdir('dist/assets')).filter(f => /^(item-(balm|seal|feather|mirror|venom|frost|chain|plume)|chart-scroll|rite-page|npc-pardoner)-.*\.png$/.test(f)).sort();
  expect(files).toHaveLength(11);
  await page.goto('/');
  await page.setContent(`<style>body{margin:20px;background:#19151b;color:#ffe3a0;font:16px Georgia}main{display:grid;grid-template-columns:repeat(6,1fr);gap:15px}figure{margin:0}img{width:180px;height:180px;object-fit:contain;background:repeating-conic-gradient(#777 0% 25%,#bbb 0% 50%) 0/24px 24px}figcaption{padding:8px}</style><h1>R03 shipped transparent sprites</h1><main>${files.map(f => `<figure><img src="/assets/${f}"><figcaption>${f.replace(/-[^-]+\.png$/, '')}</figcaption></figure>`).join('')}</main>`);
  const alpha = await page.locator('img').evaluateAll(async images => {
    return Promise.all(images.map(async node => {
      const img = node as HTMLImageElement; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0, opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) transparent++; if (pixels[i] > 240) opaque++; }
      return { transparent: transparent / (pixels.length / 4), opaque: opaque / (pixels.length / 4) };
    }));
  });
  for (const sprite of alpha) { expect(sprite.transparent).toBeGreaterThan(.1); expect(sprite.opaque).toBeGreaterThan(.01); }
  await page.screenshot({ path: test.info().outputPath('r03-transparent-art.png') });
});
