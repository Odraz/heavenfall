import { pearlyGates } from './pearly-gates';
import { sandbox } from './sandbox';
import type { DungeonDef } from './types';

export const DUNGEONS: Record<string, DungeonDef> = {
  sandbox,
  'pearly-gates': pearlyGates,
};

export function getDungeon(id: string | null | undefined): DungeonDef | undefined {
  return id != null && Object.hasOwn(DUNGEONS, id) ? DUNGEONS[id] : undefined;
}
