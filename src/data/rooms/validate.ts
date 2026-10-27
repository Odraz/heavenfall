/**
 * Room-pool validation (rogue game.md §4.7 rules 1–8 and 10, rooms.md §2.1 checks), on the template and
 * on every allowed orientation. Rule 9 (geometry) stamps a template fixture: see gen/fixture.ts.
 */
import type { Focus, RoomShape } from '../dungeons/types';
import { allowedOrientations, orientTemplate } from '../../gen/assign';
import type { RoomTemplate } from './types';
import { templateSize } from './types';

const ELITE_TP = 60;
const WAVES = { '1x1': 3, '2x1': 4, '2x2': 5 } as const;
const MIN_SPAWNS = { '1x1': 8, '2x1': 12, '2x2': 24 } as const;
/** rule 8: Σ chance ranges per 1×1, scaled ×1.5 (2×1) or ×2 (2×2) and rounded down. */
const PROPS_1X1 = { loot: [4, 8], blast: [1, 3], blessing: [0, 1] } as const;
const PROP_SCALE = { '1x1': 1, '2x1': 1.5, '2x2': 2 } as const;
/** rogue game.md §4.5: allowed primary + secondary pairs, either way round (elite + hazard not in heavens 1–2). */
const PAIRS: Array<[Focus, Focus]> = [['horde', 'flyers'], ['horde', 'hazard'], ['horde', 'elite'], ['ranged', 'hazard'], ['flyers', 'hazard']];

function heightIndex(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 122) return c - 97 + 10;
  return -1;
}

/** The placed shapes a template can take. */
export function placedShapes(t: RoomTemplate): RoomShape[] {
  return t.shape === '2x1' ? ['2x1', '1x2'] : [t.shape];
}

/** Rule violations of one template; empty when it's valid. */
export function validateTemplate(t: RoomTemplate): string[] {
  const errors: string[] = [];
  const err = (s: string) => errors.push(`${t.id}: ${s}`);
  const [W, H] = templateSize(t.shape);
  const combat = t.kind === 'combat';

  // 1. Sizes and heights.
  if (t.heights.length !== H || t.heights.some((r) => r.length !== W)) err(`heights aren't ${W} × ${H}`);
  if (t.markers.length !== H || t.markers.some((r) => r.length !== W)) err(`markers aren't ${W} × ${H}`);
  if (errors.length) return errors;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = t.heights[y][x];
      if (ch !== '#' && (heightIndex(ch) < 0 || heightIndex(ch) > 35)) err(`bad height '${ch}' at (${x}, ${y})`);
    }
  }
  if ((t.kind === 'boss') !== (t.shape === '2x2' && t.entrySocket !== undefined)) err('only a 2×2 boss has an entry socket');
  if (t.kind !== 'combat' && t.kind !== 'boss' && t.shape !== '1x1') err(`a ${t.kind} template is 1×1`);
  if (!(t.weight > 0)) err('weight must be positive');

  // 2. Every placed shape has a valid orientation (every kept physical strip clear, rogue game.md §3.4).
  for (const shape of placedShapes(t)) if (allowedOrientations(t, shape).length === 0) err(`no valid orientation as ${shape}`);

  // 3. Every obstacle has a purpose.
  const inObstacle = (x: number, y: number) => t.obstacles.some((o) => x >= o.rect.x0 && x <= o.rect.x1 && y >= o.rect.y0 && y <= o.rect.y1);
  const seen = new Uint8Array(W * H);
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < W; x0++) {
      const ch0 = t.heights[y0][x0];
      if (seen[y0 * W + x0] || ch0 === '8') continue;
      const wall = ch0 === '#';
      const group: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[x0, y0]];
      seen[y0 * W + x0] = 1;
      let touchesBorder = false;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        group.push([x, y]);
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesBorder = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
          const ch = t.heights[ny][nx];
          if (ch === '8' || (ch === '#') !== wall) continue;
          seen[ny * W + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      // Exempt: wall joined to the outer wall that only closes a non-combat room's floor in, or the boss's insets.
      if (wall && touchesBorder && !combat) continue;
      const loose = group.filter(([x, y]) => !inObstacle(x, y));
      if (loose.length) err(`untagged ${wall ? 'wall' : 'off-base floor'} at (${loose[0][0]}, ${loose[0][1]}) (${loose.length} cells)`);
    }
  }

  // 4. Spawn points.
  const xs: Array<[number, number]> = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (t.markers[y][x] === 'x') xs.push([x, y]);
  if (combat && xs.length < MIN_SPAWNS[t.shape]) err(`${xs.length} spawn points, at least ${MIN_SPAWNS[t.shape]}`);
  if ((t.kind === 'breach' || t.kind === 'pardoner' || t.kind === 'confessional') && xs.length > 0) err('a non-combat room has spawn points');
  if (t.kind === 'boss') {
    if (t.points?.addSpawns?.gate.length !== 8 || t.points.addSpawns.field.length !== 12) err('the boss has 8 gate and 12 field add markers');
    if (t.points?.watchers?.length !== 12) err('the boss has 12 Watcher anchors');
    if (!t.points?.boss || !t.gate) err('the boss has its point and gate');
  }
  for (const [x, y] of xs) if (t.heights[y][x] === '#') err(`spawn point (${x}, ${y}) on a wall`);
  // The Advocate's grille hangs on the one wall beside its point (rogue game.md §9.6).
  if (t.kind === 'confessional') {
    const a = t.points?.advocate;
    const walls = a ? [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => t.heights[a[1] + dy]?.[a[0] + dx] === '#').length : 0;
    if (!a || t.heights[a[1]][a[0]] === '#' || walls !== 1) err('the Advocate stands on floor against exactly one wall');
  }

  // 5–6. Hazards and the reward square (strip exclusions are per orientation, rule 2).
  const inHazard = (x: number, y: number) => t.hazards.some((z) => x >= z.rect.x0 && x <= z.rect.x1 && y >= z.rect.y0 && y <= z.rect.y1);
  const [rx, ry] = t.rewardSpot;
  const rh = t.heights[ry]?.[rx];
  for (let y = ry; y < ry + 4; y++) {
    for (let x = rx; x < rx + 4; x++) {
      if (t.heights[y]?.[x] !== rh || rh === '#') err('the reward square isn\'t flat floor');
      if (inHazard(x, y)) err('the reward square has a hazard');
    }
  }

  // 7. Waves.
  if (!combat && t.waves.length > 0) err('only combat templates have ordinary waves');
  if (combat) {
    if (t.waves.length !== WAVES[t.shape]) err(`${t.waves.length} waves, expected ${WAVES[t.shape]}`);
    const shares = t.waves.reduce((s, w) => s + w.share, 0);
    if (Math.abs(shares - 1) > 0.001) err(`shares sum to ${shares}`);
    // Composition at band 2 from the exact assigned TP (rogue game.md §4.6).
    const budget = { '1x1': 400, '2x1': 700, '2x2': 2000 }[t.shape];
    const room = { blessed: 0, chorister: 0, cherub: 0, elite: 0 };
    t.waves.forEach((w, i) => {
      const mix = Object.values(w.mix).reduce((s, v) => s + (v ?? 0), 0);
      if (Math.abs(mix - 1) > 0.001) err(`wave ${i + 1}'s mix sums to ${mix}`);
      const elites = (w.elites ?? 0) * ELITE_TP;
      if (elites > w.share * budget + 1e-9) err(`wave ${i + 1}'s elites exceed its share`);
      const rest = w.share * budget - elites;
      for (const k of ['blessed', 'chorister', 'cherub'] as const) room[k] += rest * (w.mix[k] ?? 0);
      room.elite += elites;
      if (i === 0 && (w.elites || Object.keys(w.mix).some((k) => k !== 'blessed'))) err('wave 1 is fodder only');
    });
    const total = room.blessed + room.chorister + room.cherub + room.elite;
    const share = (k: keyof typeof room) => room[k] / total;
    const focusOk = (f: Focus, scale: number): boolean => {
      switch (f) {
        case 'horde':
          return share('blessed') >= 0.85 * scale - 1e-9;
        case 'ranged':
          return share('chorister') >= 0.15 * scale - 1e-9 && share('chorister') <= 0.3 * scale + 1e-9;
        case 'flyers':
          return share('cherub') >= 0.15 * scale - 1e-9 && share('cherub') <= 0.3 * scale + 1e-9;
        case 'elite':
          return share('elite') <= 0.4 + 1e-9;
        case 'hazard':
          return share('blessed') >= 0.7 * scale - 1e-9;
        default:
          return false;
      }
    };
    if (!t.focus) err('a combat template has a focus');
    else if (!focusOk(t.focus, 1)) err(`composition doesn't meet its ${t.focus} focus at band 2`);
    if (t.secondary && !focusOk(t.secondary, 0.5)) err(`composition doesn't meet its ${t.secondary} secondary`);
    if (t.secondary && !PAIRS.some(([a, b]) => (a === t.focus && b === t.secondary) || (b === t.focus && a === t.secondary))) err(`${t.focus} + ${t.secondary} isn't an allowed pair`);
    if (t.shape === '2x2') {
      if (t.focus !== 'horde' && t.focus !== 'hazard') err('a 2×2 is horde or hazard');
      const last = t.waves[t.waves.length - 1];
      if (!last || last.share < 0.6 - 1e-9 || Object.keys(last.mix).some((k) => k !== 'blessed') || last.elites) err('a 2×2 ends in a crest');
    }
    if (t.bands[0] < 1 || t.bands[1] > 3 || t.bands[0] > t.bands[1]) err(`bad bands ${t.bands}`);
    if (t.shape === '2x2' && t.bands[0] < 2) err('a 2×2 is never band 1');
    // Focus geometry (rooms.md §1).
    const count = (p: string) => t.obstacles.filter((o) => o.purpose === p).length;
    const geom = (f: Focus) => {
      if (f === 'horde' && (count('kite') < 2 || count('choke') < 1 || count('high') < 1)) err('horde needs 2 kite, 1 choke, 1 high');
      if (f === 'ranged' && (count('cover') < 4 || count('high') < 1)) err('ranged needs 4 cover and 1 high');
      if (f === 'flyers' && count('cover') > 2) err('flyers allows at most 2 cover');
      if (f === 'elite' && count('kite') < 2) err('elite needs 2 kite');
    };
    if (t.focus) geom(t.focus);
  }

  // 8. Props.
  if (combat) {
    for (const fam of ['loot', 'blast', 'blessing'] as const) {
      const sum = t.props.filter((p) => p.family === fam).reduce((s, p) => s + p.chance, 0);
      const [lo, hi] = PROPS_1X1[fam].map((v) => Math.floor(v * PROP_SCALE[t.shape]));
      if (sum < lo - 1e-9 || sum > hi + 1e-9) err(`${fam} Σ chance ${sum.toFixed(2)} outside ${lo}–${hi}`);
    }
    if (!t.props.some((p) => p.family === 'loot')) err('a combat template has a loot socket');
  }
  for (const p of t.props) if (t.heights[p.at[1]][p.at[0]] === '#') err(`prop at (${p.at[0]}, ${p.at[1]}) on a wall`);

  // 10. Spawn affinity: known keys, each rect holding a spawn point.
  for (const [key, rects] of Object.entries(t.spawnAffinity ?? {})) {
    if (key !== 'chorister' && key !== 'dominion') err(`unknown affinity '${key}'`);
    for (const z of rects ?? []) if (!xs.some(([x, y]) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) err(`a ${key} affinity rect holds no spawn point`);
  }
  if (t.spawnTags?.length) err('this pool authors no restricted spawn points');

  // Every allowed orientation keeps the reward square on flat floor and the markers on floor.
  for (const shape of placedShapes(t)) {
    for (const o of allowedOrientations(t, shape)) {
      const ot = orientTemplate(t, o);
      const [ox, oy] = ot.rewardSpot;
      const h0 = ot.heights[oy][ox];
      for (let y = oy; y < oy + 4; y++) for (let x = ox; x < ox + 4; x++) if (ot.heights[y][x] !== h0) err(`orientation ${o}: the reward square isn't flat`);
    }
  }
  return errors;
}
