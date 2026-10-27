/** `ctrl` messages too large for PeerJS's JSON channel go as parts (R9 review N1). */
import { describe, expect, it } from 'vitest';
import { COIN } from '../data/pickups';
import { PINNED } from '../gen/pinned';
import { loadRunMap } from '../sim/runMap';
import { Simulation } from '../sim/sim';
import { CTRL_JSON_LIMIT, CtrlJoiner, ctrlParts, MAX_PARTS } from './ctrlParts';
import type { CtrlMessage } from './messages';
import { jsonBytes } from './netStats';

type Part = Extract<CtrlMessage, { type: 'part' }>;

/** A chat-shaped message of about `chars` characters: quotes, backslashes, control characters and non-ASCII. */
function big(chars: number): CtrlMessage {
  const unit = 'a"b\\c\u0001dée\u{1F525}f ';
  return { type: 'chat', text: unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars), playerId: 1 };
}

function join(parts: CtrlMessage[], joiner = new CtrlJoiner()): CtrlMessage | null {
  let out: CtrlMessage | null = null;
  for (const p of parts) out = p.type === 'part' ? joiner.add(p) : p;
  return out;
}

describe('ctrl parts', () => {
  it('sends a message under the limit as it is', () => {
    const msg: CtrlMessage = { type: 'chat', text: 'hello', playerId: 2 };
    expect(ctrlParts(msg, 1)).toEqual([msg]);
  });

  it('cuts a large message into parts that each fit, and joins them back exactly', () => {
    for (const chars of [20000, 60000, 150000]) {
      const msg = big(chars), parts = ctrlParts(msg, 7);
      expect(jsonBytes(msg)).toBeGreaterThanOrEqual(CTRL_JSON_LIMIT);
      expect(parts.length).toBeGreaterThan(1);
      for (const p of parts) expect(jsonBytes(p)).toBeLessThan(CTRL_JSON_LIMIT);
      expect(join(parts)).toEqual(msg);
    }
  });

  it('refuses a message too large even in parts', () => {
    expect(ctrlParts(big(600 * 1024), 1)).toEqual([]);
  });

  it('drops a message whose parts arrive out of order, interrupted or past the bounds, then joins the next', () => {
    const parts = ctrlParts(big(40000), 3) as Part[], next = ctrlParts(big(30000), 4) as Part[];
    const joiner = new CtrlJoiner();
    expect(joiner.add(parts[0])).toBeNull();
    expect(joiner.add(parts[2])).toBeNull();
    // The skipped message never completes, even when its remaining parts arrive.
    for (const p of parts.slice(1)) expect(joiner.add(p)).toBeNull();
    // A new message's first part replaces an unfinished one.
    joiner.add(parts[0]);
    expect(join(next, joiner)).toEqual(next.length > 1 ? JSON.parse(next.map((p) => p.data).join('')) : null);
    expect(joiner.add({ ...parts[0], n: MAX_PARTS + 1 })).toBeNull();
    expect(joiner.add({ type: 'part', id: 9, i: 0, n: 2, data: '{"type":"part"' })).toBeNull();
    expect(joiner.add({ type: 'part', id: 9, i: 1, n: 2, data: ',"id":1}' })).toBeNull();
    expect(joiner.add({ type: 'part', id: 10, i: 0, n: 2, data: '{"type":' })).toBeNull();
    expect(joiner.add({ type: 'part', id: 10, i: 1, n: 2, data: 'oops' })).toBeNull();
  });

  it('carries a worst-case mid-run floorSync, which is over the limit on its own', () => {
    const loaded = loadRunMap({ seed: PINNED.seed, heaven: 1, floor: 1, fixture: null });
    const sim = new Simulation({ dungeon: loaded.def, map: loaded.map, floor: loaded.floor, players: [
      { id: 0, name: 'A', classId: 'fallen' }, { id: 1, name: 'B', classId: 'heretic' }, { id: 2, name: 'C', classId: 'binder' }, { id: 3, name: 'D', classId: 'betrayer' }], seed: 1 });
    // Seventeen minutes in: a Fallen and a Heretic at their fire caps, and a field of coins.
    sim.tick = 30000;
    const map = sim.map;
    for (const p of sim.players.slice(0, 2)) {
      const fire = sim.talents.fireOf(p);
      for (let cell = 0; cell < map.w * map.h && fire.cells.size < fire.cap; cell++) fire.light(cell, sim.tick + 300, sim.tick);
    }
    for (let cell = 0; cell < map.w * map.h && sim.pickups.live.length < 128; cell += 7) {
      const room = map.roomOf[cell];
      if (room < 32 && !map.solid[cell]) sim.pickups.drop(COIN, room, (cell % map.w) + 0.37, Math.floor(cell / map.w) + 0.61, sim.tick);
    }
    const msg = sim.floorSync('r'.repeat(32));
    expect(msg.fires!.map((f) => f.cells.length)).toEqual([600, 400]);
    expect(jsonBytes(msg)).toBeGreaterThanOrEqual(CTRL_JSON_LIMIT);
    const parts = ctrlParts(msg, 1);
    for (const p of parts) expect(jsonBytes(p)).toBeLessThan(CTRL_JSON_LIMIT);
    expect(join(parts)).toEqual(JSON.parse(JSON.stringify(msg)));
  });
});
