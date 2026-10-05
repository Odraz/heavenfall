/**
 * The music tracks (M8 §9.2), in assets/music/<id>.mp3. A track not listed here isn't loaded.
 *
 * A looping track plays from its beginning each time it starts, then repeats loopStart–loopEnd
 * (seconds): bar-aligned regions where the end flows into the start, found by
 * `node scripts/music-loops.mjs`. The stings have no loop and play once.
 */
export type TrackId = 'calm' | 'arena-1' | 'arena-2' | 'arena-3' | 'boss' | 'victory' | 'defeat';

export interface TrackDef {
  id: TrackId;
  loopStart?: number;
  loopEnd?: number;
}

export const MUSIC: readonly TrackDef[] = [
  { id: 'calm', loopStart: 17.2524, loopEnd: 161.3865 },
  { id: 'arena-1', loopStart: 121.9559, loopEnd: 183.6247 },
  { id: 'arena-2', loopStart: 112.8559, loopEnd: 182.4398 },
  { id: 'arena-3', loopStart: 14.4693, loopEnd: 129.7649 },
  { id: 'boss', loopStart: 15.3783, loopEnd: 129.8538 },
  { id: 'victory' },
  { id: 'defeat' },
];
