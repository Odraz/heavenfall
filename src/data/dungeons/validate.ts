/**
 * Level validation rules (§8.1, rogue game.md §14.2), checked by unit tests for every shipped map and
 * by the generator for every stamped floor. `fixture` keeps the fixed dungeons' per-arena rules;
 * `floor` applies the generated floor's rules (a)–(e).
 */
import { DECOR } from '../decor';
import { ENEMIES, GATEKEEPER } from '../enemies';
import { EPS, WALL_TOP } from '../../sim/constants';
import { insideRect, type GameMap } from '../../sim/map';
import { circleOverlapsCell } from '../../sim/movement';

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export type ValidateMode = 'fixture' | 'floor';

/** Cells reachable from the S cells with all doors open and the given up-step limit. */
export function reachable(map: GameMap, upStep: number): Uint8Array {
  const { w, h } = map;
  const open = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && !map.wall[r * w + c];
  const ortho = (ac: number, ar: number, bc: number, br: number) =>
    open(bc, br) && map.floor[br * w + bc] - map.floor[ar * w + ac] <= upStep + EPS;
  const seen = new Uint8Array(w * h);
  const queue: number[] = [];
  for (const [c, r] of map.spawns) {
    seen[r * w + c] = 1;
    queue.push(r * w + c);
  }
  while (queue.length) {
    const a = queue.pop()!;
    const ac = a % w;
    const ar = (a - ac) / w;
    for (let k = 0; k < 8; k++) {
      const bc = ac + DX[k];
      const br = ar + DY[k];
      let ok = ortho(ac, ar, bc, br);
      if (ok && k >= 4) ok = ortho(ac, ar, bc, ar) && ortho(ac, ar, ac, br);
      if (!ok) continue;
      const b = br * w + bc;
      if (seen[b]) continue;
      seen[b] = 1;
      queue.push(b);
    }
  }
  return seen;
}

/** Returns a list of rule violations; empty when the map is valid. */
export function validateLevel(map: GameMap, markers: string[], mode: ValidateMode = 'fixture'): string[] {
  const errors: string[] = [];
  const { w, h } = map;
  const cellName = (c: number, r: number) => `(col ${c}, row ${r})`;
  const isFloor = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && !map.wall[r * w + c];
  const isWall = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && map.wall[r * w + c] === 1;
  const marker = (c: number, r: number) => markers[r][c];

  // ---- Shared checks.
  const enemy = reachable(map, 0.5);
  const player = reachable(map, 1.0);
  for (let i = 0; i < w * h; i++) {
    if (enemy[i] !== player[i]) {
      errors.push(`jump-only perch: ${cellName(i % w, Math.floor(i / w))} is player-reachable but not enemy-reachable`);
    }
  }

  const xCells: Array<[number, number]> = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (marker(c, r) === 'x') xCells.push([c, r]);

  map.rooms.forEach((a, ai) => {
    const inRect = (c: number, r: number) => c >= a.rect.x0 && c <= a.rect.x1 && r >= a.rect.y0 && r <= a.rect.y1;
    for (const e of a.entry) {
      for (const [c, r] of e.cells) if (!enemy[r * w + c]) errors.push(`room ${ai}: entry cell ${cellName(c, r)} isn't enemy-reachable`);
    }
    for (let bi = ai + 1; bi < map.rooms.length; bi++) {
      const b = map.rooms[bi];
      if (a.rect.x0 <= b.rect.x1 && b.rect.x0 <= a.rect.x1 && a.rect.y0 <= b.rect.y1 && b.rect.y0 <= a.rect.y1) {
        errors.push(`rooms ${ai} and ${bi} overlap`);
      }
    }
    // Sealed: with all doors closed, no floor cell inside the rect has a floor neighbor outside it.
    const closedFloor = (c: number, r: number) => isFloor(c, r) && marker(c, r) !== 'D';
    for (let r = a.rect.y0; r <= a.rect.y1; r++) {
      for (let c = a.rect.x0; c <= a.rect.x1; c++) {
        if (!closedFloor(c, r)) continue;
        for (let k = 0; k < 8; k++) {
          const nc = c + DX[k];
          const nr = r + DY[k];
          if (!inRect(nc, nr) && closedFloor(nc, nr)) {
            errors.push(`room ${ai} isn't sealed: ${cellName(c, r)} touches ${cellName(nc, nr)}`);
          }
        }
      }
    }
  });

  for (const [c, r] of xCells) {
    if (!map.rooms.some((a) => insideRect(a, c + 0.5, r + 0.5))) errors.push(`x cell ${cellName(c, r)} isn't inside any room`);
  }

  for (let c = 0; c < w; c++) {
    if (isFloor(c, 0)) errors.push(`border cell ${cellName(c, 0)} isn't a wall`);
    if (isFloor(c, h - 1)) errors.push(`border cell ${cellName(c, h - 1)} isn't a wall`);
  }
  for (let r = 0; r < h; r++) {
    if (isFloor(0, r)) errors.push(`border cell ${cellName(0, r)} isn't a wall`);
    if (isFloor(w - 1, r)) errors.push(`border cell ${cellName(w - 1, r)} isn't a wall`);
  }

  // Computed wall heights stay under the cap (M10 §3.2).
  for (let i = 0; i < w * h; i++) {
    if (map.heights.height[i] > WALL_TOP + EPS) errors.push(`wall ${cellName(i % w, Math.floor(i / w))} is ${map.heights.height[i]} m high, above ${WALL_TOP} m`);
  }

  // Large decorations stand on pedestals nobody can reach, so nobody walks through them.
  for (const d of map.decorations) {
    if (DECOR[d.id].large && player[d.r * w + d.c]) errors.push(`large decoration '${d.id}' at ${cellName(d.c, d.r)} is player-reachable`);
  }

  // ---- Per-room rules.
  const entryOk = (ai: number, cells: ReadonlyArray<[number, number]>) => {
    const a = map.rooms[ai];
    const inRect = (c: number, r: number) => c >= a.rect.x0 && c <= a.rect.x1 && r >= a.rect.y0 && r <= a.rect.y1;
    const keys = new Set(cells.map(([c, r]) => `${c},${r}`));
    if (cells.length !== 4 || keys.size !== 4) errors.push(`room ${ai}: needs exactly 4 distinct entry cells per entry`);
    for (const [c, r] of cells) {
      if (!isFloor(c, r) || !inRect(c, r) || marker(c, r) === 'D') {
        errors.push(`room ${ai}: entry cell ${cellName(c, r)} must be a non-door floor cell inside the rect`);
      }
    }
  };
  const xIn = (ai: number) => xCells.filter(([c, r]) => insideRect(map.rooms[ai], c + 0.5, r + 0.5));

  if (mode === 'fixture') {
    map.rooms.forEach((a, ai) => {
      const xs = xIn(ai);
      if (xs.length < 6) errors.push(`room ${ai}: only ${xs.length} x cells in its rect`);
      for (const [c, r] of xs) if (!enemy[r * w + c]) errors.push(`room ${ai}: x cell ${cellName(c, r)} isn't enemy-reachable`);
      if (a.entry.length !== 1) errors.push(`room ${ai}: a fixture arena has exactly one entry`);
      for (const e of a.entry) entryOk(ai, e.cells);
      for (const [c, r] of map.spawns) if (insideRect(a, c + 0.5, r + 0.5)) errors.push(`room ${ai}: S cell ${cellName(c, r)} inside its rect`);
    });
    const bossRooms = map.rooms.map((a, i) => (a.boss ? i : -1)).filter((i) => i >= 0);
    if ((map.boss !== null) !== (bossRooms.length > 0)) errors.push('a B cell must exist exactly when there is a boss room');
    if (bossRooms.some((i) => i !== map.rooms.length - 1)) errors.push('only the last arena can be a boss arena');
    if (map.boss && bossRooms.length > 0) checkBossCell(map.rooms.length - 1);
    return errors;
  }

  // ---- Floor mode (rogue game.md §14.2 (a)–(e)).
  map.rooms.forEach((a, ai) => {
    if (a.boss !== (a.kind === 'boss')) errors.push(`room ${ai}: boss flag disagrees with kind '${a.kind}'`);
    const xs = xIn(ai);
    // (a) x cells only in combat rooms (the boss's are its add markers), at least 6, each enemy-reachable.
    if (a.kind === 'combat' && xs.length < 6) errors.push(`room ${ai}: only ${xs.length} x cells in its rect`);
    if (a.kind !== 'combat' && a.kind !== 'boss' && xs.length > 0) errors.push(`room ${ai}: a ${a.kind} room has x cells`);
    for (const [c, r] of xs) if (!enemy[r * w + c]) errors.push(`room ${ai}: x cell ${cellName(c, r)} isn't enemy-reachable`);
    if (a.kind === 'combat' && a.waves.length === 0) errors.push(`room ${ai}: an ordinary combat room has no waves`);
    if (a.kind !== 'combat' && a.waves.length > 0) errors.push(`room ${ai}: a ${a.kind} room has ordinary waves`);
    // (b) one entry per used socket, 4 non-door floor cells inside the rect each.
    const used = a.leaves.map((l) => l.socket).join(',');
    const entries = a.entry.map((e) => e.socket).join(',');
    if (used !== entries) errors.push(`room ${ai}: entry sockets [${entries}] differ from its leaves' [${used}]`);
    for (const e of a.entry) entryOk(ai, e.cells);
  });

  // (c) the 4 S cells in the Breach and no other room.
  const breaches = map.rooms.map((a, i) => (a.kind === 'breach' ? i : -1)).filter((i) => i >= 0);
  if (breaches.length !== 1) errors.push(`expected exactly one breach, found ${breaches.length}`);
  for (const [c, r] of map.spawns) {
    const inside = map.rooms.map((a, i) => (insideRect(a, c + 0.5, r + 0.5) ? i : -1)).filter((i) => i >= 0);
    if (inside.length !== 1 || map.rooms[inside[0]].kind !== 'breach') errors.push(`S cell ${cellName(c, r)} isn't inside the breach alone`);
  }

  // (d) exactly one boss room, B inside it on its dais; its add markers and entries reachable.
  const bossRooms = map.rooms.map((a, i) => (a.boss ? i : -1)).filter((i) => i >= 0);
  if (bossRooms.length !== 1) errors.push(`expected exactly one boss room, found ${bossRooms.length}`);
  if (!map.boss) errors.push('the floor has no B cell');
  if (bossRooms.length === 1 && map.boss) {
    const bi = bossRooms[0];
    const b = map.rooms[bi];
    const [bc, br] = map.boss;
    if (!insideRect(b, bc + 0.5, br + 0.5)) errors.push('the B cell is outside the boss room');
    checkBossCell(bi);
    const adds = [...(b.points?.addSpawns?.gate ?? []), ...(b.points?.addSpawns?.field ?? [])];
    for (const [c, r] of adds) if (!enemy[r * w + c]) errors.push(`boss add marker ${cellName(c, r)} isn't enemy-reachable`);
    for (const [c, r] of b.points?.watchers ?? []) if (!isFloor(c, r) || !insideRect(b, c + 0.5, r + 0.5)) errors.push(`Watcher anchor ${cellName(c, r)} isn't floor in the boss room`);

    // (e) the gate's posts on the boss room's gate wall, its face open floor, the outside wall.
    const g = map.gate;
    if (!g) errors.push('the floor has no gate');
    else {
      const inside = (u: number): [number, number] =>
        g.facing === 'W' ? [g.plane, u] : g.facing === 'E' ? [g.plane - 1, u] : g.facing === 'N' ? [u, g.plane] : [u, g.plane - 1];
      const outside = (u: number): [number, number] =>
        g.facing === 'W' ? [g.plane - 1, u] : g.facing === 'E' ? [g.plane, u] : g.facing === 'N' ? [u, g.plane - 1] : [u, g.plane];
      for (let u = g.u0; u < g.u1; u++) {
        const [oc, or] = outside(u);
        if (!isWall(oc, or)) errors.push(`gate: the cell outside its plane at ${cellName(oc, or)} isn't wall`);
        const [ic, ir] = inside(u);
        const post = u === g.u0 || u === g.u1 - 1;
        if (post && !isWall(ic, ir)) errors.push(`gate: post cell ${cellName(ic, ir)} isn't wall`);
        if (!post && (!isFloor(ic, ir) || !insideRect(b, ic + 0.5, ir + 0.5))) errors.push(`gate: face cell ${cellName(ic, ir)} isn't floor in the boss room`);
      }
    }
  }
  return errors;

  /** The B cell isn't player-reachable, and the Gatekeeper's body fits on floor at its height. */
  function checkBossCell(_bi: number): void {
    const [bc, br] = map.boss!;
    if (player[br * w + bc]) errors.push(`B cell ${cellName(bc, br)} is player-reachable`);
    const last = map.rooms[_bi];
    if (!insideRect(last, bc + 0.5, br + 0.5)) {
      if (mode === 'fixture') errors.push('the B cell is outside the boss arena');
      return;
    }
    const bh = map.floor[br * w + bc];
    const rad = ENEMIES[GATEKEEPER].radius;
    const x = bc + 0.5;
    const y = br + 0.5;
    for (let r = Math.floor(y - rad); r <= Math.floor(y + rad); r++) {
      for (let c = Math.floor(x - rad); c <= Math.floor(x + rad); c++) {
        if (!circleOverlapsCell(x, y, rad, c, r)) continue;
        if (!isFloor(c, r) || Math.abs(map.floor[r * w + c] - bh) > EPS) {
          errors.push(`the Gatekeeper on B overlaps ${cellName(c, r)}, which isn't floor at the B height`);
        }
      }
    }
  }
}
