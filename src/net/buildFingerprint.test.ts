import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { buildFingerprint, sourceHash } from '../../buildFingerprint';
import { Lobby } from './lobby';
import { PROTOCOL_VERSION, RULES_VERSION } from './version';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it('hashes sorted relative paths and LF bytes, excluding tests/testutil; dirty source and renames change identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'heavenfall-fingerprint-')); dirs.push(root);
  mkdirSync(join(root, 'src', 'nested'), { recursive: true });
  mkdirSync(join(root, 'src', 'testutil'));
  writeFileSync(join(root, 'src', 'z.ts'), 'z\r\n');
  writeFileSync(join(root, 'src', 'nested', 'a.ts'), 'a\r\n');
  writeFileSync(join(root, 'src', 'z.test.ts'), 'ignored');
  writeFileSync(join(root, 'src', 'testutil', 'helper.ts'), 'ignored');
  const expected = createHash('sha256').update('src/nested/a.ts\0a\n\0src/z.ts\0z\n\0').digest('hex').slice(0, 12);
  expect(sourceHash(root)).toBe(expected);
  writeFileSync(join(root, 'src', 'nested', 'a.ts'), 'a\n');
  writeFileSync(join(root, 'src', 'z.ts'), 'z\n');
  writeFileSync(join(root, 'src', 'z.test.ts'), 'changed');
  writeFileSync(join(root, 'src', 'testutil', 'helper.ts'), 'changed');
  expect(sourceHash(root)).toBe(expected);
  writeFileSync(join(root, 'src', 'z.ts'), 'dirty\n');
  expect(sourceHash(root)).not.toBe(expected);
  writeFileSync(join(root, 'src', 'z.ts'), 'z\n');
  rmSync(join(root, 'src', 'nested', 'a.ts'));
  writeFileSync(join(root, 'src', 'nested', 'b.ts'), 'a\n');
  expect(sourceHash(root)).not.toBe(expected);
});

it('pins protocol/rules/content in the handshake and rejects a dirty-build mismatch before admission', () => {
  expect([PROTOCOL_VERSION, RULES_VERSION]).toEqual([3, 2]);
  const host = buildFingerprint('0.1.0', 'abc1234', PROTOCOL_VERSION, RULES_VERSION, '0123456789ab');
  expect(host).toBe('0.1.0+abc1234.p3.r2.0123456789ab');
  expect(__BUILD_VERSION__).toMatch(/^0\.1\.0\+(?:[0-9a-f]+|nogit)\.p3\.r2\.[0-9a-f]{12}$/);
  const lobby = new Lobby({ heaven: 1, fixture: null, version: host, password: 'pw', hostName: 'Host' });
  const other = buildFingerprint('0.1.0', 'abc1234', PROTOCOL_VERSION, RULES_VERSION, 'abcdef012345');
  expect(lobby.join('Guest', 'wrong', other)).toEqual({ ok: false, reason: 'version' });
  expect(lobby.run).toBeNull(); expect(lobby.lobbyMessage().players).toHaveLength(1);
  expect(lobby.join('Guest', 'pw', host).ok).toBe(true);
});
