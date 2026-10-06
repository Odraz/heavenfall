export type ClassId = 'fallen' | 'heretic' | 'binder' | 'betrayer';
/** A hint line's key (M9 §6.2): an ability, or the mouse button of an attack. */
export type HintKey = 'Q' | 'E' | 'LMB' | 'RMB';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  hp: number;
  /** Horizontal movement speed in m/s. */
  speed: number;
  /** The class's passive trait, shown on the class card under the role and HP, with its tooltip. */
  passive: { name: string; description: string };
  /**
   * The hints panel's lines (M8 §2.2, §2.4); `key` puts that ability's icon beside the line, or the
   * mouse glyph for an attack (M9 §6.2).
   */
  hints: ReadonlyArray<{ key?: HintKey; text: string }>;
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
      { key: 'LMB', text: 'The shotgun blasts back the crowd at your feet.' },
      { key: 'RMB', text: 'The slug hits one enemy far away.' },
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
    passive: { name: 'Last Rites', description: 'Revives fallen teammates twice as fast.' },
    hints: [
      { key: 'LMB', text: 'Censers leave burning incense. Throw them where the crowd is held.' },
      { key: 'RMB', text: 'Hold on a teammate (gold marker) to heal them.' },
      { key: 'Q', text: 'Q heals everyone near you. Stay close to the party.' },
      { key: 'E', text: 'E: shield a teammate (gold marker), or yourself. When enemies break it, it blasts the enemies around them.' },
      { text: 'You revive fallen teammates twice as fast.' },
    ],
  },
  binder: {
    id: 'binder',
    name: 'The Binder',
    role: 'Support',
    hp: 200,
    speed: 6,
    passive: { name: 'Fetters', description: 'Every Chain Gun and Scourge hit slows the enemy for 1 s.' },
    hints: [
      { key: 'LMB', text: 'Every bullet slows its target.' },
      { key: 'RMB', text: 'Swing your chain when the swarm reaches you.' },
      { key: 'Q', text: 'Q: pull a crowd together, then let the party shred it. Bound enemies take double damage.' },
      { key: 'E', text: "E: silence Choristers, Cherubs and the Gatekeeper's Judgment." },
    ],
  },
  betrayer: {
    id: 'betrayer',
    name: 'The Betrayer',
    role: 'Damage',
    hp: 120,
    speed: 9,
    passive: { name: 'Into the Night', description: 'The fastest of the damned: outruns every other class.' },
    hints: [
      { key: 'LMB', text: 'Fast shots, one enemy at a time.' },
      { key: 'RMB', text: "Wait until enemies line up: the bullet tears through the line until it's spent." },
      { key: 'Q', text: 'Q: go where the party fights and toss the silver. Everyone in it fires twice as fast.' },
      { key: 'E', text: 'E: dash out of trouble.' },
    ],
  },
};

export function isClassId(s: unknown): s is ClassId {
  return s === 'fallen' || s === 'heretic' || s === 'binder' || s === 'betrayer';
}
