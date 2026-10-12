/**
 * The block notation (rooms.md §2.1): every template is written on 2 m blocks and expanded here into a
 * `RoomTemplate` at import. Pure; throws on malformed input.
 */
import { heightChar } from '../dungeons/build';
import type { Focus, Rect, RoomKind } from '../dungeons/types';
import { socketList, stripCells } from '../../gen/transform';
import type { MixId, PropFamily, Purpose, RoomTemplate, TemplateShape, TemplateWave } from './types';

const KINDS: readonly RoomKind[] = ['breach', 'pardoner', 'confessional', 'combat', 'boss'];
const SHAPES: readonly TemplateShape[] = ['1x1', '2x1', '2x2'];
const FOCI: readonly Focus[] = ['horde', 'ranged', 'flyers', 'elite', 'hazard', 'ground'];
const PURPOSES: readonly Purpose[] = ['cover', 'kite', 'high', 'choke', 'jump', 'spawn', 'lure'];
const MIX: Record<string, MixId> = { blessed: 'blessed', chorister: 'chorister', cherub: 'cherub' };

/** Level glyphs: their floor in meters ('#': wall). */
const LEVEL: Record<string, number> = { '.': 2, ':': 2, '~': 1.5, '-': 1, '=': 0, '1': 3, '2': 4, '3': 5, '4': 6, B: 3.5 };
const STAIRS = '><^v';
const PROP_GLYPH: Record<string, PropFamily> = { o: 'loot', '!': 'blast', '+': 'blessing' };
const DECOR_GLYPHS = 'cuhtaf';

/**
 * The Chorister preference rectangles (rooms.md §2.3), canonical cells, inclusive; attached at
 * expansion and transformed with the template.
 */
const SPAWN_AFFINITY: Record<string, Rect[]> = {
  'pg-c-1x1-ranged-01': [r(0, 0, 9, 7), r(22, 0, 31, 7)],
  'pg-c-1x1-ranged-02': [r(0, 0, 7, 7), r(24, 0, 31, 7), r(0, 24, 7, 31), r(24, 24, 31, 31)],
  'pg-c-1x1-ranged-03': [r(0, 20, 31, 31)],
  'pg-c-1x1-ranged-hazard-01': [r(22, 24, 31, 31)],
  'pg-c-2x1-ranged-01': [r(0, 0, 9, 9), r(58, 0, 67, 9), r(0, 18, 9, 31), r(58, 18, 67, 31)],
};

function r(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0, y0, x1, y1 };
}

/** The Gate's canonical wall plane (rooms.md §4): the west boundary, the 52-cell span 8–60 centered on 34. */
const BOSS_GATE = { facing: 'W', plane: 0, u0: 8, u1: 60, uCenter: 34 } as const;
/** Boss add markers at cell x ≤ this are the gate group, the rest the field group (rooms.md §2.1). */
const GATE_GROUP_MAX_X = 5;

class NotationError extends Error {
  constructor(id: string, why: string) {
    super(`room ${id}: ${why}`);
    this.name = 'NotationError';
  }
}

/** Expands one `room` block of rooms.md into a template. */
export function expandRoom(text: string): RoomTemplate {
  const lines = text.split(/\r?\n/);
  const fields = new Map<string, string>();
  const grid: Array<[string, string]> = [];
  const obstacleLines: string[] = [];
  const waveLines: string[] = [];
  const wallLines: string[] = [];
  let section: 'grid' | 'obstacles' | 'waves' | null = null;
  for (const raw of lines) {
    if (raw.trim() === '') continue;
    const m = /^(\S+)\s*(.*)$/.exec(raw);
    if (m && !/^\s/.test(raw) && !/^\d+$/.test(m[1])) {
      const [, key, rest] = m;
      section = null;
      if (key === 'grid' || key === 'obstacles' || key === 'waves') section = key;
      else if (key === 'walls') wallLines.push(rest.trim());
      else fields.set(key, rest.trim());
      continue;
    }
    if (section === 'grid') {
      const g = /^\s*(\d+)\s+(\S+)\s+(\S+)\s*$/.exec(raw);
      if (!g) throw new NotationError(fields.get('id') ?? '?', `bad grid line '${raw}'`);
      if (Number(g[1]) !== grid.length) throw new NotationError(fields.get('id') ?? '?', `grid row ${g[1]} out of order`);
      grid.push([g[2], g[3]]);
    } else if (section === 'obstacles') obstacleLines.push(raw.trim());
    else if (section === 'waves') waveLines.push(raw.trim());
    else throw new NotationError(fields.get('id') ?? '?', `unexpected line '${raw}'`);
  }

  const id = fields.get('id');
  if (!id) throw new NotationError('?', 'no id');
  const fail = (why: string): never => {
    throw new NotationError(id, why);
  };
  const kind = fields.get('kind') as RoomKind;
  if (!KINDS.includes(kind)) fail(`unknown kind '${kind}'`);
  const shape = fields.get('shape') as TemplateShape;
  if (!SHAPES.includes(shape)) fail(`unknown shape '${shape}'`);
  const bw = shape === '1x1' ? 16 : 34;
  const bh = shape === '2x2' ? 34 : 16;
  if (grid.length !== bh) fail(`${grid.length} grid rows, expected ${bh}`);
  for (const [hRow, fRow] of grid) if (hRow.length !== bw || fRow.length !== bw) fail(`a grid row isn't ${bw} blocks wide`);
  const hg = (bx: number, by: number) => grid[by][0][bx];
  const fg = (bx: number, by: number) => grid[by][1][bx];

  // ---- Heights: level glyphs, then every stair run (rooms.md §2.1 "Stairs, exactly").
  const W = bw * 2;
  const H = bh * 2;
  const cells: number[][] = Array.from({ length: H }, () => new Array<number>(W).fill(NaN));
  const level = (bx: number, by: number): number => {
    if (bx < 0 || by < 0 || bx >= bw || by >= bh) return fail(`a stair at block (${bx}, ${by})'s end is outside the room`);
    const g = hg(bx, by);
    if (g === '#' || STAIRS.includes(g)) return fail(`a stair end at block (${bx}, ${by}) isn't a level glyph`);
    const v = LEVEL[g];
    if (v === undefined) return fail(`unknown height glyph '${g}'`);
    return v;
  };
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const g = hg(bx, by);
      if (STAIRS.includes(g)) continue;
      const v = g === '#' ? -1 : LEVEL[g];
      if (v === undefined) fail(`unknown height glyph '${g}' at block (${bx}, ${by})`);
      for (let y = 2 * by; y < 2 * by + 2; y++) for (let x = 2 * bx; x < 2 * bx + 2; x++) cells[y][x] = v;
    }
  }
  for (const dir of STAIRS) {
    const horizontal = dir === '>' || dir === '<';
    const outer = horizontal ? bh : bw;
    const inner = horizontal ? bw : bh;
    for (let o = 0; o < outer; o++) {
      for (let s = 0; s < inner; ) {
        const at = (k: number) => (horizontal ? hg(k, o) : hg(o, k));
        if (at(s) !== dir) {
          s++;
          continue;
        }
        let e = s;
        while (e + 1 < inner && at(e + 1) === dir) e++;
        // The low end is against the arrow, the high end along it.
        const rising = dir === '>' || dir === 'v';
        const lowK = rising ? s - 1 : e + 1;
        const highK = rising ? e + 1 : s - 1;
        const A = horizontal ? level(lowK, o) : level(o, lowK);
        const B = horizontal ? level(highK, o) : level(o, highK);
        if (!(A < B)) fail(`the stair run at block (${horizontal ? s : o}, ${horizontal ? o : s}) doesn't climb`);
        const k = 2 * (e - s + 1);
        if (B - A > 0.5 * (k + 1) + 1e-9) fail(`the stair run at block (${horizontal ? s : o}, ${horizontal ? o : s}) climbs ${B - A} m over ${k} cells`);
        for (let i = 1; i <= k; i++) {
          const z = Math.min(A + 0.5 * i, B);
          // Cell i, counted from the low end along the arrow.
          const along = rising ? 2 * s + (i - 1) : 2 * e + 1 - (i - 1);
          for (let across = 2 * o; across < 2 * o + 2; across++) {
            if (horizontal) cells[across][along] = z;
            else cells[along][across] = z;
          }
        }
        s = e + 1;
      }
    }
  }
  const heights: string[] = cells.map((row) => row.map((v) => (v < 0 ? '#' : heightChar(Math.round(v / 0.25)))).join(''));
  const wallRect = (rest: string): Rect => {
    const m = /^(\d+),(\d+)\s+(\d+),(\d+)$/.exec(rest);
    if (!m) return fail(`bad walls line '${rest}'`);
    return r(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]));
  };
  const heightRows = heights.map((row) => [...row]);
  for (const line of wallLines) {
    const w = wallRect(line);
    for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) heightRows[y][x] = '#';
  }

  // ---- Strips: exactly the shape's strip blocks carry ':' (the boss: only its entry's).
  const entrySocket = fields.has('entry') ? Number(fields.get('entry')) : undefined;
  if (kind === 'boss' && (entrySocket === undefined || !Number.isInteger(entrySocket))) fail('a boss needs an entry socket');
  if (kind !== 'boss' && entrySocket !== undefined) fail('only a boss has an entry socket');
  const stripBlocks = new Set<string>();
  socketList(shape).forEach((_, s) => {
    if (kind === 'boss' && s !== entrySocket) return;
    for (const [x, y] of stripCells(shape, s)) stripBlocks.add(`${x >> 1},${y >> 1}`);
  });
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const isStrip = stripBlocks.has(`${bx},${by}`);
      if ((hg(bx, by) === ':') !== isStrip) fail(isStrip ? `strip block (${bx}, ${by}) isn't ':'` : `':' block (${bx}, ${by}) is outside its shape's strips`);
    }
  }

  // ---- Features.
  const markers = Array.from({ length: H }, () => new Array<string>(W).fill('.'));
  const propChance: Record<PropFamily, number> = { loot: 0, blast: 0, blessing: 0 };
  const propsLine = fields.get('props');
  if (propsLine) {
    const t = propsLine.split(/\s+/);
    for (let i = 0; i + 1 < t.length; i += 2) {
      const fam = t[i] as PropFamily;
      if (!(fam in propChance)) fail(`unknown prop family '${t[i]}'`);
      propChance[fam] = Number(t[i + 1]);
    }
  }
  const props: RoomTemplate['props'] = [];
  const reward: Array<[number, number]> = [];
  const xs: Array<[number, number]> = [];
  const pedestals: Array<[number, number]> = [];
  let map: [number, number] | null = null;
  let advocate: [number, number] | null = null;
  let bossPoint: [number, number] | null = null;
  const watchers: Array<[number, number]> = [];
  let sCount = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const f = fg(bx, by);
      const at: [number, number] = [2 * bx, 2 * by];
      if (f === '.') continue;
      if (f === 'x') {
        markers[at[1]][at[0]] = 'x';
        xs.push(at);
      } else if (PROP_GLYPH[f]) props.push({ at, family: PROP_GLYPH[f], chance: propChance[PROP_GLYPH[f]] });
      else if (f === 'R') reward.push([bx, by]);
      else if (DECOR_GLYPHS.includes(f)) {
        if ((f === 'a' || f === 'f') && hg(bx, by) !== 'B') fail(`'${f}' at block (${bx}, ${by}) isn't on a B block`);
        markers[at[1]][at[0]] = f;
      } else if (f === 'S') {
        markers[at[1]][at[0]] = 'S';
        sCount++;
      } else if (f === 'P') pedestals.push(at);
      else if (f === 'M') {
        if (map) fail('more than one M');
        map = at;
      } else if (f === 'A') advocate = at;
      else if (f === 'K') {
        if (bossPoint) fail('more than one K');
        bossPoint = at;
        markers[at[1]][at[0]] = 'B';
      } else if (f === 'w') watchers.push(at);
      else fail(`unknown feature glyph '${f}' at block (${bx}, ${by})`);
    }
  }
  if (sCount !== (kind === 'breach' ? 4 : 0)) fail(`${sCount} S, expected ${kind === 'breach' ? 4 : 0}`);
  if (pedestals.length !== (kind === 'pardoner' ? 4 : 0)) fail(`${pedestals.length} P, expected ${kind === 'pardoner' ? 4 : 0}`);
  if ((map ? 1 : 0) !== (kind === 'pardoner' ? 1 : 0)) fail(`${map ? 1 : 0} M, expected ${kind === 'pardoner' ? 1 : 0}`);
  if (advocate && kind !== 'confessional') fail('an A outside the Confessional');
  if (bossPoint && kind !== 'boss') fail('a K outside the boss room');
  if (kind === 'boss' && !bossPoint) fail('a boss needs a K');
  if (watchers.length > 0 && kind !== 'boss') fail('w outside the boss room');
  if (reward.length !== 4) fail(`${reward.length} R blocks, expected 4`);
  const rx = Math.min(...reward.map(([x]) => x));
  const ry = Math.min(...reward.map(([, y]) => y));
  if (!reward.every(([x, y]) => (x === rx || x === rx + 1) && (y === ry || y === ry + 1))) fail('the R blocks aren\'t a 2 × 2 square');

  // ---- Obstacles, hazards, waves.
  const obstacles: RoomTemplate['obstacles'] = obstacleLines.map((line) => {
    const m = /^(\S+)\s+(\d+),(\d+)\s+(\d+),(\d+)\s*(.*)$/.exec(line);
    if (!m) return fail(`bad obstacle line '${line}'`);
    const purpose = m[1] as Purpose;
    if (!PURPOSES.includes(purpose)) fail(`unknown purpose '${m[1]}'`);
    const o: RoomTemplate['obstacles'][number] = { rect: r(2 * Number(m[2]), 2 * Number(m[3]), 2 * Number(m[4]) + 1, 2 * Number(m[5]) + 1), purpose };
    if (m[6]) o.note = m[6];
    return o;
  });
  const hazards: RoomTemplate['hazards'] = [];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; ) {
      if (hg(bx, by) !== '~') {
        bx++;
        continue;
      }
      let e = bx;
      while (e + 1 < bw && hg(e + 1, by) === '~') e++;
      hazards.push({ rect: r(2 * bx, 2 * by, 2 * e + 1, 2 * by + 1), hazard: 'refiners-fire' });
      bx = e + 1;
    }
  }
  const waves: TemplateWave[] = waveLines.map((line, i) => {
    const t = line.split(/\s+/);
    if (Number(t[0]) !== i + 1) fail(`wave ${t[0]} out of order`);
    const w: TemplateWave = { share: Number(t[1]), mix: {} };
    for (let k = 2; k + 1 < t.length; k += 2) {
      if (t[k] === 'elites') w.elites = Number(t[k + 1]);
      else {
        const id2 = MIX[t[k]];
        if (!id2) fail(`unknown enemy '${t[k]}' in wave ${i + 1}`);
        w.mix[id2] = Number(t[k + 1]);
      }
    }
    return w;
  });

  // ---- The template.
  const bandsField = fields.get('bands');
  let bands: [number, number] = [1, 3];
  if (kind === 'combat') {
    if (!bandsField) fail('a combat template needs bands');
    const [a, b] = bandsField!.split(/\s+/).map(Number);
    bands = [a, b];
  }
  const t: RoomTemplate = {
    id,
    name: fields.get('name') ?? id,
    heaven: 1,
    kind,
    shape,
    bands,
    weight: fields.has('weight') ? Number(fields.get('weight')) : 1,
    heights: heightRows.map((row) => row.join('')),
    markers: markers.map((row) => row.join('')),
    obstacles,
    hazards,
    props,
    rewardSpot: [2 * rx, 2 * ry],
    waves,
  };
  const focus = fields.get('focus') as Focus | undefined;
  if (focus !== undefined) {
    if (!FOCI.includes(focus)) fail(`unknown focus '${focus}'`);
    t.focus = focus;
  }
  const secondary = fields.get('secondary') as Focus | undefined;
  if (secondary !== undefined) {
    if (!FOCI.includes(secondary)) fail(`unknown secondary '${secondary}'`);
    t.secondary = secondary;
  }
  if (entrySocket !== undefined) t.entrySocket = entrySocket;
  if (SPAWN_AFFINITY[id]) t.spawnAffinity = { chorister: SPAWN_AFFINITY[id].map((a) => ({ ...a })) };
  if (kind === 'pardoner') t.points = { pedestals: [...pedestals, map!] };
  if (kind === 'confessional' && advocate) t.points = { advocate };
  if (kind === 'boss') {
    t.points = {
      boss: bossPoint!,
      watchers,
      addSpawns: { gate: xs.filter(([x]) => x <= GATE_GROUP_MAX_X), field: xs.filter(([x]) => x > GATE_GROUP_MAX_X) },
    };
    t.gate = { ...BOSS_GATE };
  }
  return t;
}
