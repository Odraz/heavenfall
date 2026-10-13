import { adaptFixture } from './fixture';
import { pearlyGates } from './pearly-gates';
import { sandbox } from './sandbox';
import { dominionLab } from './dominion';
import { refinerLab } from './refiner';
import { arrivalLab } from './arrival';
import { crestLab } from './crest';
import type { DungeonDef } from './types';

/** The fixed dungeons (development fixtures), adapted to room records. */
export const DUNGEONS: Record<string, DungeonDef> = {
  dominion: dominionLab,
  cantor: familyLab('cantor'),
  carrier: familyLab('carrier'),
  refiner: refinerLab,
  arrival: arrivalLab,
  crest: crestLab,
  sandbox: adaptFixture(sandbox),
  'pearly-gates': adaptFixture(pearlyGates),
};

export function getDungeon(id: string | null | undefined): DungeonDef | undefined {
  return id != null && Object.hasOwn(DUNGEONS, id) ? DUNGEONS[id] : undefined;
}

/** The same reviewed geometry as Dominion, with an explicit family commander. */
function familyLab(family: 'cantor' | 'carrier'): DungeonDef {
  return { ...dominionLab, id: family, name: family === 'cantor' ? 'The Lectern Cantor encounter' : 'The Stray-Carrier encounter',
    rooms: dominionLab.rooms!.map((r) => ({ ...r, waves: r.waves.map((w) => ({ ...w, commander: family })) })) };
}
