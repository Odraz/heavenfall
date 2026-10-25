/**
 * The asset manifest (docs/rogue/asset-manifest.md) says what is really in the game (R8): every row
 * marked integrated names runtime files that exist and that the game loads.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Row { id: string; kind: string; required: string; status: string; source: string; runtime: string }

function rows(): Row[] {
  const out: Row[] = [];
  for (const line of readFileSync('docs/rogue/asset-manifest.md', 'utf8').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 13 || cells[1] === 'assetId' || cells[1].startsWith('---')) continue;
    out.push({ id: cells[1], kind: cells[2], required: cells[3], status: cells[5], source: cells[6], runtime: cells[7] });
  }
  return out;
}

/** The backticked paths of a cell, braces expanded (`a/{b,c}.png`); `-01..03` ranges expanded too. */
function paths(cell: string): string[] {
  const out: string[] = [];
  for (const [, raw] of cell.matchAll(/`([^`]+)`/g)) {
    let list = [raw];
    for (;;) {
      const next = list.flatMap((p) => { const m = /\{([^{}]+)\}/.exec(p); return m ? m[1].split(',').map((x) => p.replace(m[0], x)) : [p]; });
      if (next.length === list.length && next.every((p, i) => p === list[i])) break;
      list = next;
    }
    list = list.flatMap((p) => { const m = /-(\d\d)\.\.(\d\d)\./.exec(p); if (!m) return [p]; const r: string[] = []; for (let i = +m[1]; i <= +m[2]; i++) r.push(p.replace(m[0], `-${String(i).padStart(2, '0')}.`)); return r; });
    out.push(...list);
  }
  return out;
}

/** Every source file's text, to check that a runtime file is loaded by something. */
function sources(dir = 'src'): string {
  let text = '';
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) text += sources(p);
    else if (/\.(ts|css)$/.test(name) && !/\.test\.ts$/.test(name)) text += readFileSync(p, 'utf8');
  }
  return text;
}

const INTEGRATED = new Set(['integrated', 'integrated-review', 'accepted']);
/** Runtime folders the game loads by glob or by atlas manifest, not by file name. */
const GLOBBED = ['assets/sfx/', 'assets/sprites/weapon-', 'assets/music/'];

describe('the asset manifest (R8)', () => {
  const all = rows(), code = sources();

  it('parses every table row with a known status', () => {
    expect(all.length).toBeGreaterThan(200);
    for (const r of all) expect(['requested', 'received', 'reuse-review', 'integrated', 'integrated-review', 'accepted', 'consumed'], r.id).toContain(r.status);
  });

  it('names existing runtime files, loaded by the game, for every integrated row', () => {
    const missing: string[] = [], unused: string[] = [];
    for (const r of all.filter((r) => INTEGRATED.has(r.status) && r.kind !== 'coded' && r.kind !== 'synth')) {
      const files = paths(r.runtime);
      if (!files.length) { missing.push(`${r.id}: no runtime path`); continue; }
      for (const f of files) {
        if (f.includes('*')) continue;
        if (!existsSync(f)) missing.push(`${r.id}: ${f}`);
        const name = f.split('/').pop()!.replace(/\.[a-z0-9]+$/, '').replace(/-\d\d$/, '');
        if (!GLOBBED.some((g) => f.startsWith(g)) && !code.includes(name)) unused.push(`${r.id}: ${f}`);
      }
    }
    expect(missing).toEqual([]);
    expect(unused).toEqual([]);
  });

  it('leaves no required art or recording merely requested', () => {
    const open = all.filter((r) => r.required === 'yes' && r.status === 'requested' && r.kind !== 'coded');
    expect(open.map((r) => r.id)).toEqual([]);
  });
});
