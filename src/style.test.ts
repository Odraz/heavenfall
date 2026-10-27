/** Stylesheet conventions (R01–R03 audit C1, C3): multi-line rules, grouped by feature, on the :root tokens. */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('./style.css');
// Custom properties the client sets at run time instead of in the stylesheet.
const RUNTIME_PROPERTIES = ['--item-cooldown', '--relic-cooldown'];

it('writes every rule over several lines', () => {
  const oneLine = css.split('\n').filter((line) => !line.trim().startsWith('/*') && /\{[^}]*;[^}]*\}\s*$/.test(line));
  expect(oneLine).toEqual([]);
});

it('uses only custom properties it declares', () => {
  const declared = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).concat(RUNTIME_PROPERTIES));
  const unknown = [...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((name) => !declared.has(name));
  expect(unknown).toEqual([]);
});

it('keeps the purple-black panels out of the HUD and maps', () => {
  // R1.5–R03 drew its panels in #19151b / #18141b; the game's darks are the warm soot family.
  for (const source of [css, read('./client/mapView.ts'), read('./client/mapIcons.ts')]) {
    expect(source).not.toMatch(/#(19151b|18141b)/i);
  }
});
