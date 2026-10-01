/** A `test` that fails on any console error or uncaught page error (§13.2). */
import { test as base, expect, type Page } from '@playwright/test';
import type { DebugState } from '../src/debug';

export const test = base.extend<{ failOnErrors: void }>({
  failOnErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
      await use();
      expect(errors, 'console errors and page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Reads `window.__heavenfall`. */
export function state(page: Page): Promise<DebugState> {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__heavenfall)) as DebugState);
}
