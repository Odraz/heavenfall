export type ClassId = 'fallen' | 'heretic' | 'binder' | 'betrayer';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  hp: number;
  /** Horizontal movement speed in m/s. */
  speed: number;
  /** A passive shown on the class card's weapon line, with its tooltip (M8 §2.1). */
  passive?: { name: string; description: string };
  /** The hints panel's lines (M8 §2.2, §2.4); `key` puts that ability's icon beside the line. */
  hints: ReadonlyArray<{ key?: 'Q' | 'E'; text: string }>;
}

/** The hints panel's general lines, after the class's, in multiplayer only (M8 §2.4). */
export const GENERAL_HINTS: readonly string[] = ["Shoot a fallen teammate's soul to revive them.", 'Enter: chat.'];

export const CLASS_IDS: readonly ClassId[] = ['fallen', 'heretic', 'binder', 'betrayer'];

export const CLASSES: Record<ClassId, ClassDef> = {
  fallen: {
    id: 'fallen',
    name: 'The Fallen',
    role: 'Tank',
    hp: 400,
    speed: 6,
    passive: { name: 'Brimstone Hide', description: 'Takes 40% less damage. Enemies prefer to attack the Fallen.' },
    hints: [
      { text: 'Stand in front: you take less damage and enemies prefer you.' },
      { key: 'Q', text: 'Q: when a teammate is swarmed, taunt the swarm off them.' },
      { key: 'E', text: 'E: aim at a teammate (gold marker) to leap to their rescue.' },
    ],
  },
  heretic: {
    id: 'heretic',
    name: 'The Heretic Saint',
    role: 'Healer',
    hp: 150,
    speed: 8,
    hints: [
      { key: 'Q', text: 'Q heals everyone near you. Stay close to the party.' },
      { key: 'E', text: 'E: aim at a teammate (gold marker) to shield them. Otherwise it shields you.' },
      { text: 'You revive fallen teammates twice as fast.' },
    ],
  },
  binder: {
    id: 'binder',
    name: 'The Binder',
    role: 'Support',
    hp: 200,
    speed: 6,
    hints: [
      { key: 'Q', text: 'Q: pull a crowd together, then let the party shred it. Bound enemies take double damage.' },
      { key: 'E', text: "E: silence Choristers, Cherubs and the Gatekeeper's Judgment." },
      { text: 'Every bullet slows its target.' },
    ],
  },
  betrayer: {
    id: 'betrayer',
    name: 'The Betrayer',
    role: 'Damage',
    hp: 120,
    speed: 9,
    hints: [
      { text: 'Shoot along a line of enemies: each shot pierces up to 6.' },
      { key: 'Q', text: 'Q: go where the party fights and toss the silver. Everyone in it fires twice as fast.' },
      { key: 'E', text: 'E: dash out of trouble.' },
    ],
  },
};

export function isClassId(s: unknown): s is ClassId {
  return s === 'fallen' || s === 'heretic' || s === 'binder' || s === 'betrayer';
}
