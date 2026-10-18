import { describe, expect, it } from 'vitest';
import { ALT_ABILITIES, TALENT_NODES } from '../data/talents';
import { spriteUrl } from '../render/atlas';
import { talentIcon } from './talents';

describe('talent icons (art-prompts.md B11)', () => {
  it.each(['fallen', 'heretic', 'binder', 'betrayer'] as const)('gives every %s node an icon: its ability\'s for an ability node, its own talent icon otherwise', (classId) => {
    const nodes = TALENT_NODES[classId];
    expect(nodes).toHaveLength(21);
    for (const n of nodes) {
      const icon = talentIcon(n);
      expect(icon, n.id).not.toBeNull();
      expect(() => spriteUrl(icon!)).not.toThrow();
      if (n.teaches) expect(icon).toBe(ALT_ABILITIES[n.teaches.ability].icon);
      else expect(icon).toBe(`talent-${n.id.replace(/\./g, '-')}`);
    }
    // The 18 non-ability nodes each have their own picture.
    expect(new Set(nodes.filter((n) => !n.teaches).map(talentIcon)).size).toBe(18);
  });
});
