import { describe, expect, it } from 'vitest';
import { BLESSED, ENEMIES } from '../data/enemies';
import { attackDef, FIRE_LEFT } from '../data/weapons';
import { OwnCensers, type CenserBreak } from '../client/ownCensers';
import { aimDir } from './combat';
import { PLAYER_EYE, TICK_DT } from './constants';
import { NO_VIEW } from './lagComp';
import { PROJ_CENSER } from './sim';
import { enemyAt, makeSim, put, room } from './testutil/sims';

/**
 * Netcode stage 4: a Heretic's censer flies on the host against the enemies where the thrower's screen drew
 * them, `lag` ticks behind the host, and the thrower's screen flies its own against the same drawn enemies.
 * A Blessed, stunned so only the test moves it, follows `path(tick)`; the screen throws drawing tick VIEW.
 * The thrower aims at `aim`, or where it drew the Blessed. Returns where each side's censer broke and
 * whether it hit.
 */
const VIEW = 20;
function duel(lag: number, path: (tick: number) => [number, number], compensated = true, aim?: [number, number]) {
  const sim = makeSim(room(40, 20), ['heretic'], { god: true, noWaves: true });
  const p = sim.players[0];
  put(sim, p, 3.5, 10.5);
  const s = enemyAt(sim, BLESSED, ...path(0));
  const place = () => { [sim.eX[s], sim.eY[s]] = path(sim.tick + 1); sim.eStunUntil[s] = sim.tick + 1000; };
  for (let i = 0; i < VIEW + lag; i++) { place(); sim.step(); }
  // The screen draws the snapshot `lag` ticks behind the newest the host has.
  const view = sim.tick - lag;
  const [ax, ay] = aim ?? path(view);
  const ez = p.z + PLAYER_EYE, dz = sim.eZ[s] + ENEMIES[BLESSED].height / 2 - ez;
  p.yaw = Math.atan2(ay - p.y, ax - p.x);
  p.pitch = Math.atan2(dz, Math.hypot(ax - p.x, ay - p.y));
  p.view = compensated ? { tick: view, gap: 0, frac: 0 } : NO_VIEW;
  p.fire = FIRE_LEFT;
  p.fireTimer = 0;
  place(); sim.step();
  p.fire = 0;
  const slot = [...Array(sim.pAlive.length).keys()].find((q) => sim.pAlive[q] && sim.pKind[q] === PROJ_CENSER)!;
  expect(slot).toBeDefined();
  let host: { x: number; y: number } | null = null;
  for (let i = 0; i < 60 && !host; i++) {
    place(); sim.step();
    if (!sim.pAlive[slot]) host = { x: sim.clouds.at(-1)!.x, y: sim.clouds.at(-1)!.y };
  }
  // The screen: the same throw, its enemy drawn `lag` ticks behind the host, frame by frame from the view.
  const own = new OwnCensers();
  const [dx, dy, ddz] = aimDir(p.yaw, p.pitch);
  own.throw(0, p.x, p.y, ez, dx, dy, ddz, attackDef('heretic', 0).range, p.x, p.y, ez);
  let local: CenserBreak | null = null;
  for (let k = 0; k < 60 && !local; k++) {
    const [x, y] = path(view + k);
    const enemies = { count: 1, x: [x], y: [y], type: [BLESSED] };
    local = own.step(k * TICK_DT * 1000, TICK_DT, { map: sim.map, enemies, enemyZ: [sim.eZ[s]], souls: [], props: [], broken: new Set(), passBlessed: false })[0] ?? null;
  }
  return { host: host!, hostHit: !sim.eAlive[s] || sim.eHp[s] < ENEMIES[BLESSED].hp, local: local!, localHit: !!local && local.enemy >= 0 };
}

describe('censer flight in the thrower\'s view (netcode stage 4)', () => {
  // Crossing the censer's line at 6 m/s, 12 m away: on the thrower's screen it reaches the line as the
  // censer does, about 17 ticks after the throw. The thrower aims where it will cross.
  const crossing = (tick: number): [number, number] => [15.5, 10.5 + 6 * TICK_DT * (VIEW + 17.5 - tick)];
  const line: [number, number] = [15.5, 10.5];

  it('hits an enemy crossing its path where the thrower saw it cross, as the thrower\'s screen does', () => {
    for (const lag of [3, 6, 9]) {
      const r = duel(lag, crossing, true, line);
      expect(r.localHit).toBe(true);
      expect(r.hostHit).toBe(true);
      expect(Math.hypot(r.host.x - r.local.x, r.host.y - r.local.y)).toBeLessThan(0.6);
    }
  });

  it('without the thrower\'s view it flies against the present, and misses the crossing enemy', () => {
    const r = duel(9, crossing, false, line);
    expect(r.localHit).toBe(true);
    expect(r.hostHit).toBe(false);
  });

  it('breaks on an enemy walking at the thrower where the thrower\'s screen breaks it', () => {
    // 3 m/s straight at the Heretic, from 18 m.
    const walking = (tick: number): [number, number] => [21.5 - 3 * TICK_DT * tick, 10.5];
    for (const lag of [0, 6, 12]) {
      const r = duel(lag, walking);
      expect(r.hostHit && r.localHit).toBe(true);
      expect(Math.hypot(r.host.x - r.local.x, r.host.y - r.local.y)).toBeLessThan(0.4);
    }
    // Against the present the host's breaks well short of the screen's, 0.4 s of walking nearer.
    const r = duel(12, walking, false);
    expect(Math.hypot(r.host.x - r.local.x, r.host.y - r.local.y)).toBeGreaterThan(0.8);
  });
});
