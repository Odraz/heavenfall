import { describe, expect, it } from 'vitest';
import { ALT_ABILITIES, TALENT_NODES, talentNode } from '../data/talents';
import { spriteUrl } from '../render/atlas';
import { lockReason, talentIcon } from './talents';

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

describe('talent tooltips (R06 follow-up §1)', () => {
  const node = (id: string) => talentNode(id)!;
  it('names a conflicting talent from another tree, with the class weapon', () => {
    expect(lockReason(node('fallen.c.1a'), ['fallen.b.1b'], 'Fire and Brimstone and Heave change the same thing'))
      .toBe("Can't combine with Fire and Brimstone: both change the Brimstone Shotgun.");
    expect(lockReason(node('betrayer.b.1b'), ['betrayer.c.1a'], 'x')).toBe("Can't combine with The Nail: both change the Silver Bullet.");
  });
  it('says how many lower talents a tier still needs', () => {
    expect(lockReason(node('fallen.a.3a'), ['fallen.a.1a'], 'Gatebreaker needs 3 lower A talents')).toBe('Learn 2 more talents lower in this tree first.');
    expect(lockReason(node('fallen.a.2a'), [], 'x')).toBe('Learn 1 more talent lower in this tree first.');
  });
  it('words the other refusals plainly, and has nothing to say when the node is open', () => {
    expect(lockReason(node('fallen.a.1a'), [], 'Not enough talent points')).toBe('No talent points left.');
    expect(lockReason(node('fallen.a.1a'), [], null)).toBeNull();
  });
  it('keeps rule-engine words out of every rule', () => {
    for (const nodes of Object.values(TALENT_NODES)) for (const n of nodes) {
      expect(n.rule, n.id).not.toMatch(/Delivery|Payload|button kill|kindles|pooled|censed|root|Needs .* enemies/i);
    }
  });
});
