import { expect, test } from './fixtures';

// M10 §8.2: the Pearly Gates loads with no console errors (the fixture) and no warnings or failed
// requests about missing textures.
test('pearly-gates loads with every texture', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && /texture|image|404|not found/i.test(m.text())) problems.push(`warning: ${m.text()}`);
  });
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`);
  });
  await page.goto('/?dev=1&map=pearly-gates&class=fallen&seed=1');
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 30_000 });
  await page.waitForTimeout(2000);
  expect(problems).toEqual([]);
});
