import { describe, expect, it } from 'vitest';
import { parseParams } from './params';
import { validName } from './ui/menus';

describe('URL parameters (§2.5)', () => {
  it('opens the menus without dev=1 or bench=1', () => {
    const p = parseParams('');
    expect(p.dev).toBe(false);
    expect(p.bench).toBe(false);
  });

  it('skips the menus with dev=1, defaulting an invalid map and class', () => {
    const p = parseParams('?dev=1&map=nowhere&class=angel');
    expect(p).toMatchObject({ dev: true, mapId: 'sandbox', classId: 'fallen' });
    expect(parseParams('?dev=1&map=pearly-gates&class=binder')).toMatchObject({ mapId: 'pearly-gates', classId: 'binder' });
  });

  it('honors seed only together with dev=1', () => {
    expect(parseParams('?dev=1&seed=7').seed).toBe(7);
    expect(parseParams('?seed=7').seed).toBeNull();
  });

  it('keeps bot and god with the menus', () => {
    expect(parseParams('?bot=1&god=1')).toMatchObject({ dev: false, bot: true, god: true });
  });

  it('ignores other parameters with bench=1', () => {
    expect(parseParams('?bench=1&dev=1&bot=1&god=1&class=fallen')).toMatchObject({ bench: true, dev: false, bot: false, god: false, classId: 'betrayer', mapId: 'sandbox', benchView: 'turn' });
  });

  it('takes the map and the view with bench=1 (M10 §2.3)', () => {
    expect(parseParams('?bench=1&map=pearly-gates&view=arcade')).toMatchObject({ bench: true, mapId: 'pearly-gates', benchView: 'arcade' });
    expect(parseParams('?bench=1&map=nowhere')).toMatchObject({ mapId: 'sandbox', benchView: 'turn' });
  });
});

describe('player name (§3)', () => {
  it('is 1 to 16 characters after trimming', () => {
    expect(validName('')).toBeNull();
    expect(validName('   ')).toBeNull();
    expect(validName('  Ann  ')).toBe('Ann');
    expect(validName('x'.repeat(16))).toBe('x'.repeat(16));
    expect(validName('x'.repeat(17))).toBeNull();
  });
});
