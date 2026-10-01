export type ClassId = 'fallen' | 'heretic' | 'binder' | 'betrayer';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  hp: number;
  /** Horizontal movement speed in m/s. */
  speed: number;
  description: string;
}

export const CLASS_IDS: readonly ClassId[] = ['fallen', 'heretic', 'binder', 'betrayer'];

export const CLASSES: Record<ClassId, ClassDef> = {
  fallen: {
    id: 'fallen',
    name: 'The Fallen',
    role: 'Tank',
    hp: 400,
    speed: 7,
    description: 'Takes 40% less damage and draws the host of Heaven to itself.',
  },
  heretic: {
    id: 'heretic',
    name: 'The Heretic Saint',
    role: 'Healer',
    hp: 150,
    speed: 8,
    description: 'Heals the party and shields an ally from harm.',
  },
  binder: {
    id: 'binder',
    name: 'The Binder',
    role: 'Support',
    hp: 200,
    speed: 8,
    description: 'Slows, pulls and silences the swarm.',
  },
  betrayer: {
    id: 'betrayer',
    name: 'The Betrayer',
    role: 'Damage',
    hp: 120,
    speed: 9,
    description: 'Fragile, but marks and executes the mightiest foes.',
  },
};

export function isClassId(s: string | null | undefined): s is ClassId {
  return s === 'fallen' || s === 'heretic' || s === 'binder' || s === 'betrayer';
}
