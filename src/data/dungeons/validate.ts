/** Level validation rules (§8.1), checked by unit tests for every shipped map. */
import { DECOR } from '../decor';
import { ENEMIES, GATEKEEPER } from '../enemies';
import { EPS } from '../../sim/constants';
import { insideRect, type GameMap } from '../../sim/map';
import { circleOverlapsCell } from '../../sim/movement';

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

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
export function validateLevel(map: GameMap, markers: string[]): string[] {
  const errors: string[] = [];
  const { w, h } = map;
  const cellName = (c: number, r: number) => `(col ${c}, row ${r})`;
  const isFloor = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && !map.wall[r * w + c];
  const marker = (c: number, r: number) => markers[r][c];

  const enemy = reachable(map, 0.5);
  const player = reachable(map, 1.0);
  for (let i = 0; i < w * h; i++) {
    if (enemy[i] !== player[i]) {
      errors.push(`jump-only perch: ${cellName(i % w, Math.floor(i / w))} is player-reachable but not enemy-reachable`);
    }
  }

  const xCells: Array<[number, number]> = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (marker(c, r) === 'x') xCells.push([c, r]);

  map.arenas.forEach((a, ai) => {
    for (const [c, r] of a.entryCells) {
      if (!enemy[r * w + c]) errors.push(`arena ${ai}: entry cell ${cellName(c, r)} isn't enemy-reachable`);
    }
    const inRect = (c: number, r: number) => c >= a.rect.x0 && c <= a.rect.x1 && r >= a.rect.y0 && r <= a.rect.y1;
    const xs = xCells.filter(([c, r]) => inRect(c, r));
    if (xs.length < 6) errors.push(`arena ${ai}: only ${xs.length} x cells in its rect`);
    for (const [c, r] of xs) if (!enemy[r * w + c]) errors.push(`arena ${ai}: x cell ${cellName(c, r)} isn't enemy-reachable`);

    const keys = new Set(a.entryCells.map(([c, r]) => `${c},${r}`));
    if (a.entryCells.length !== 4 || keys.size !== 4) errors.push(`arena ${ai}: needs exactly 4 distinct entry cells`);
    for (const [c, r] of a.entryCells) {
      if (!isFloor(c, r) || !inRect(c, r) || marker(c, r) === 'D') {
        errors.push(`arena ${ai}: entry cell ${cellName(c, r)} must be a non-door floor cell inside the rect`);
      }
    }

    for (let bi = ai + 1; bi < map.arenas.length; bi++) {
      const b = map.arenas[bi];
      if (a.rect.x0 <= b.rect.x1 && b.rect.x0 <= a.rect.x1 && a.rect.y0 <= b.rect.y1 && b.rect.y0 <= a.rect.y1) {
        errors.push(`arenas ${ai} and ${bi} overlap`);
      }
    }
    for (const [c, r] of map.spawns) if (inRect(c, r)) errors.push(`arena ${ai}: S cell ${cellName(c, r)} inside its rect`);

    // Sealed: with all doors closed, no floor cell inside the rect has a floor neighbor outside it.
    const closedFloor = (c: number, r: number) => isFloor(c, r) && marker(c, r) !== 'D';
    for (let r = a.rect.y0; r <= a.rect.y1; r++) {
      for (let c = a.rect.x0; c <= a.rect.x1; c++) {
        if (!closedFloor(c, r)) continue;
        for (let k = 0; k < 8; k++) {
          const nc = c + DX[k];
          const nr = r + DY[k];
          if (!inRect(nc, nr) && closedFloor(nc, nr)) {
            errors.push(`arena ${ai} isn't sealed: ${cellName(c, r)} touches ${cellName(nc, nr)}`);
          }
        }
      }
    }
  });

  for (const [c, r] of xCells) {
    if (!map.arenas.some((a) => insideRect(a, c + 0.5, r + 0.5))) errors.push(`x cell ${cellName(c, r)} isn't inside any arena`);
  }

  for (let c = 0; c < w; c++) {
    if (isFloor(c, 0)) errors.push(`border cell ${cellName(c, 0)} isn't a wall`);
    if (isFloor(c, h - 1)) errors.push(`border cell ${cellName(c, h - 1)} isn't a wall`);
  }
  for (let r = 0; r < h; r++) {
    if (isFloor(0, r)) errors.push(`border cell ${cellName(0, r)} isn't a wall`);
    if (isFloor(w - 1, r)) errors.push(`border cell ${cellName(w - 1, r)} isn't a wall`);
  }

  const bossArenas = map.arenas.map((a, i) => (a.boss ? i : -1)).filter((i) => i >= 0);
  if ((map.boss !== null) !== (bossArenas.length > 0)) errors.push('a B cell must exist exactly when there is a boss arena');
  if (bossArenas.some((i) => i !== map.arenas.length - 1)) errors.push('only the last arena can be a boss arena');
  if (map.boss && bossArenas.length > 0) {
    const [bc, br] = map.boss;
    if (player[br * w + bc]) errors.push(`B cell ${cellName(bc, br)} is player-reachable`);
    const last = map.arenas[map.arenas.length - 1];
    if (!insideRect(last, bc + 0.5, br + 0.5)) errors.push('the B cell is outside the boss arena');
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

  // Large decorations stand on pedestals nobody can reach, so nobody walks through them.
  for (const d of map.decorations) {
    if (DECOR[d.id].large && player[d.r * w + d.c]) errors.push(`large decoration '${d.id}' at ${cellName(d.c, d.r)} is player-reachable`);
  }
  return errors;
}
