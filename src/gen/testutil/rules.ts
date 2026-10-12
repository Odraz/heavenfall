/**
 * Every rule of rogue game.md §3.3 checked on a generated floor, plus the stamped floor's validation and
 * a coarse zone-leak check (§14.9). Test support only.
 */
import { validateLevel } from '../../data/dungeons/validate';
import type { RoomTemplate } from '../../data/rooms/types';
import { HEADROOM } from '../../sim/heights';
import { lineOfSight } from '../../sim/los';
import { setLeafCells, type GameMap } from '../../sim/map';
import { allowedOrientations, orientTemplate, templateShapeFor } from '../assign';
import type { GeneratedFloor } from '../generate';
import { dirTo, GRID, outerFace } from '../layout';
import { DIR_DX, DIR_DY, type Dir } from '../transform';
import { roomCount } from '../generate';

export function floorRuleErrors(g: GeneratedFloor, pool: readonly RoomTemplate[]): string[] {
  const errors: string[] = [];
  const err = (s: string) => errors.push(s);
  const f = g.floor;
  const rooms = f.rooms;
  const n = rooms.length;
  if (n !== f.n) err(`n ${f.n} but ${n} rooms`);
  if (!f.fallbackUsed && n !== roomCount(f.seed, f.heaven)) err(`${n} rooms, expected ${roomCount(f.seed, f.heaven)}`);
  if (f.fallbackUsed && n !== 11) err('the fallback has 11 rooms');

  // Kinds and shapes.
  const kinds = rooms.map((r) => r.kind);
  if (kinds[0] !== 'breach' || rooms[0].shape !== '1x1' || rooms[0].slots[0][0] !== 3 || rooms[0].slots[0][1] !== 3) err('room 0 must be the 1×1 Breach at (3, 3)');
  if (kinds[n - 1] !== 'boss' || rooms[n - 1].shape !== '2x2' || f.boss !== n - 1) err('the boss must be the last room, 2×2');
  for (const k of ['breach', 'pardoner', 'confessional', 'boss'] as const) if (kinds.filter((x) => x === k).length !== 1) err(`exactly one ${k}`);
  const combat = rooms.flatMap((r, i) => (r.kind === 'combat' ? [i] : []));
  if (combat.length !== n - 4) err(`${combat.length} combat rooms, expected ${n - 4}`);
  if (combat.filter((i) => rooms[i].shape === '2x2').length !== 1) err('exactly one 2×2 combat room');
  if (combat.filter((i) => rooms[i].shape === '2x1' || rooms[i].shape === '1x2').length > 2) err('at most two 2×1/1×2');

  // The slots: in the grid, disjoint; a tree whose doors are the only adjacencies.
  const occ = new Int8Array(GRID * GRID).fill(-1);
  rooms.forEach((r, i) => {
    for (const [x, y] of r.slots) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) err(`room ${i} outside the grid`);
      else if (occ[y * GRID + x] >= 0) err(`slot (${x}, ${y}) used twice`);
      else occ[y * GRID + x] = i;
    }
  });
  let edges = 0;
  rooms.forEach((r, i) => {
    for (const d of r.doors) {
      const back = rooms[d.to]?.doors.filter((q) => q.to === i) ?? [];
      if (back.length !== 1) err(`door ${i}–${d.to} isn't mutual`);
      if (d.to > i) edges++;
    }
    if (new Set(r.doors.map((d) => d.to)).size !== r.doors.length) err(`room ${i} has two doors to one room`);
  });
  if (edges !== n - 1) err(`${edges} doors, a tree has ${n - 1}`);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = occ[y * GRID + x];
      if (a < 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const b = x + dx < GRID && y + dy < GRID ? occ[(y + dy) * GRID + x + dx] : -1;
        if (b >= 0 && b !== a && !rooms[a].doors.some((d) => d.to === b)) err(`rooms ${a} and ${b} touch without a door`);
      }
    }
  }
  // dist from the Breach.
  const dist = new Array<number>(n).fill(-1);
  dist[0] = 0;
  const q = [0];
  while (q.length) {
    const i = q.shift()!;
    for (const d of rooms[i].doors) if (dist[d.to] < 0) {
      dist[d.to] = dist[i] + 1;
      q.push(d.to);
    }
  }
  rooms.forEach((r, i) => {
    if (dist[i] !== r.dist) err(`room ${i} dist ${r.dist}, BFS ${dist[i]}`);
  });
  const leaf = (i: number) => i > 0 && rooms[i].doors.length === 1;

  // The Confessional and the boss.
  const c = f.confessional;
  const b = f.boss;
  if (rooms[c].kind !== 'confessional' || rooms[c].shape !== '1x1' || rooms[c].doors.length !== 2 || rooms[c].dist < 3) err('the Confessional is a 1×1 with 2 doors at dist ≥ 3');
  if (rooms[b].doors.length !== 1 || rooms[b].doors[0].to !== c) err("the boss's only door is the Confessional's");
  if (rooms[b].dist < 4) err('the boss is at dist ≥ 4');
  const occupied = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && occ[y * GRID + x] >= 0;
  const bSlot = rooms[b].slots.find(([x, y]) => Math.abs(x - rooms[c].slots[0][0]) + Math.abs(y - rooms[c].slots[0][1]) === 1)!;
  const backDir = ((dirTo(bSlot, rooms[c].slots[0]) + 2) & 3) as Dir;
  const gateSlots = rooms[b].slots.filter(([x, y]) => !rooms[b].slots.some(([a2, b2]) => a2 === x + DIR_DX[backDir] && b2 === y + DIR_DY[backDir]));
  if (!gateSlots.every(([x, y]) => outerFace(occupied, x, y, backDir))) err("the boss's gate wall isn't outer");
  // Its stamped gate faces that way.
  const facing = ['N', 'E', 'S', 'W'][backDir];
  if (g.def.gate?.facing !== facing) err(`the gate faces ${g.def.gate?.facing}, the gate wall ${facing}`);

  // The Reliquary, the Pardoner, the marked rooms.
  const rq = f.reliquary;
  if (rooms[rq].kind !== 'combat' || !leaf(rq) || rooms[rq].shape === '2x2' || rooms[rq].dist < 3 || rq === c) err('the Reliquary is a non-2×2 combat leaf at dist ≥ 3');
  const pd = f.pardoner;
  if (rooms[pd].kind !== 'pardoner' || !leaf(pd) || rooms[pd].shape !== '1x1' || rooms[pd].dist < 2) err('the Pardoner is a 1×1 leaf at dist ≥ 2');
  if (rooms[f.keyRoom].kind !== 'combat' || f.keyRoom === rq || rooms[f.keyRoom].dist < 2) err('the key room is a combat room other than the Reliquary at dist ≥ 2');
  if (rooms[f.mapRoom].kind !== 'combat') err('the map room is a combat room');
  const [b0, b1] = f.bells;
  if (b0 === b1 || [b0, b1].some((i) => rooms[i].kind !== 'combat' || i === f.keyRoom || rooms[i].shape === '2x2')) err('two distinct bell rooms, combat, not the key room, not 2×2');
  if (!f.props.some((p) => p.marked && p.room === f.mapRoom && p.family === 'loot')) err('the marked reliquary is in the map room');

  // Bands, templates, orientations.
  const used = new Set<string>();
  rooms.forEach((r, i) => {
    const t = pool.find((p) => p.id === r.templateId);
    if (!t) return err(`room ${i}: unknown template ${r.templateId}`);
    if (t.kind !== r.kind) err(`room ${i}: a ${t.kind} template in a ${r.kind} room`);
    if (r.kind === 'combat') {
      const d = Math.min(3, r.dist);
      const band = r.shape === '2x2' ? Math.max(2, d) : d;
      if (r.band !== band) err(`room ${i}: band ${r.band}, expected ${band}`);
      if (t.shape !== templateShapeFor(r.shape)) err(`room ${i}: template shape ${t.shape} in a ${r.shape} room`);
      if (used.has(t.id)) err(`template ${t.id} repeated`);
      used.add(t.id);
    }
    if (!allowedOrientations(t, r.shape).includes(r.orientation)) err(`room ${i}: orientation ${r.orientation} isn't valid for ${t.id}`);
    if (r.kind === 'boss' && orientTemplate(t, r.orientation).entrySocket !== r.doors[0].socket) err("the boss's entry socket isn't its door");
  });

  // The stamped floor.
  for (const e of validateLevel(g.map, g.def.markers, 'floor').slice(0, 5)) err(`validateLevel: ${e}`);
  for (const e of zoneLeaks(g.map).slice(0, 3)) err(e);
  return errors;
}

/**
 * The coarse zone-leak check: with every leaf closed, no line between sample points of two different
 * rooms, at the highest point anything reaches above their floors, is clear.
 */
export function zoneLeaks(map: GameMap): string[] {
  const closed = { ...map, solid: new Uint8Array(map.solid), top: new Float32Array(map.top) };
  for (const room of map.rooms) for (const leaf of room.leaves) setLeafCells(closed, leaf.cells, true);
  const pts = map.rooms.map((r) => {
    const out: Array<[number, number, number]> = [];
    for (const fx of [0.15, 0.5, 0.85]) {
      for (const fy of [0.15, 0.5, 0.85]) {
        const c = Math.floor(r.rect.x0 + (r.rect.x1 - r.rect.x0) * fx);
        const rr = Math.floor(r.rect.y0 + (r.rect.y1 - r.rect.y0) * fy);
        const i = rr * map.w + c;
        if (map.wall[i]) continue;
        out.push([c + 0.5, rr + 0.5, map.floor[i] + HEADROOM - 0.5]);
      }
    }
    return out;
  });
  const leaks: string[] = [];
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      for (const p of pts[a]) {
        for (const q of pts[b]) {
          if (lineOfSight(closed, p[0], p[1], p[2], q[0], q[1], q[2])) {
            leaks.push(`rooms ${a} and ${b} see each other with the doors closed: (${p.map((v) => v.toFixed(1))}) → (${q.map((v) => v.toFixed(1))})`);
          }
        }
      }
    }
  }
  return leaks;
}
