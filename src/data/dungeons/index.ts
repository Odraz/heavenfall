import { adaptFixture } from './fixture';
import { pearlyGates } from './pearly-gates';
import { sandbox } from './sandbox';
import { dominionLab } from './dominion';
import { refinerLab } from './refiner';
import type { DungeonDef } from './types';

/** The fixed dungeons (development fixtures), adapted to room records. */
export const DUNGEONS: Record<string, DungeonDef> = {
  dominion: dominionLab,
  refiner: refinerLab,
  sandbox: adaptFixture(sandbox),
  'pearly-gates': adaptFixture(pearlyGates),
};

export function getDungeon(id: string | null | undefined): DungeonDef | undefined {
  return id != null && Object.hasOwn(DUNGEONS, id) ? DUNGEONS[id] : undefined;
}
