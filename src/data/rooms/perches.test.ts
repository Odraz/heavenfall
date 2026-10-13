import { expect, it } from 'vitest';
import { PEARLY_POOL } from './1';
import { templateFixture } from '../../gen/fixture';
import { reachable } from '../dungeons/validate';
import { DECOR } from '../decor';

it('gives every authored combat platform a ground route from the entry', () => {
  const failures: string[] = [];
  const breach = PEARLY_POOL.find((t) => t.kind === 'breach')!;
  for (const t of PEARLY_POOL.filter((t) => t.kind === 'combat')) {
    const { map } = templateFixture(t, 0, t.shape, breach);
    const ground = reachable(map, 0.5), rect = map.rooms[1].rect;
    // Fountain/statue plinths are intentionally inaccessible and must remain so.
    const plinths = t.obstacles.filter((o) => map.decorations.some((d) => DECOR[d.id].large &&
      d.c - rect.x0 >= o.rect.x0 && d.c - rect.x0 <= o.rect.x1 && d.r - rect.y0 >= o.rect.y0 && d.r - rect.y0 <= o.rect.y1));
    const blocks = new Set<string>();
    for (let r = rect.y0; r <= rect.y1; r++) for (let c = rect.x0; c <= rect.x1; c++) {
      const i = r * map.w + c;
      if (!map.wall[i] && !ground[i] && !plinths.some((o) => c - rect.x0 >= o.rect.x0 && c - rect.x0 <= o.rect.x1 && r - rect.y0 >= o.rect.y0 && r - rect.y0 <= o.rect.y1))
        blocks.add(`${Math.floor((c - rect.x0) / 2)},${Math.floor((r - rect.y0) / 2)}:${map.floor[i]}`);
    }
    if (blocks.size) failures.push(`${t.id}: ${[...blocks].join(' ')}`);
  }
  expect(failures).toEqual([]);
});
