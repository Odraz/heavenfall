/** Build-time source identity (rogue r01.md): stable paths and LF bytes across checkouts. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function sourceHash(root: string): string {
  const paths: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'testutil') walk(path);
      } else if (entry.isFile() && !entry.name.endsWith('.test.ts')) paths.push(path);
    }
  };
  walk('src');
  const hash = createHash('sha256');
  for (const path of paths.sort()) {
    hash.update(path).update('\0');
    // Latin-1 round-trips every byte, including any future binary source assets.
    hash.update(Buffer.from(readFileSync(join(root, path)).toString('latin1').replace(/\r\n/g, '\n'), 'latin1')).update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export function buildFingerprint(version: string, gitShort: string, protocol: number, rules: number, hash: string): string {
  return `${version}+${gitShort}.p${protocol}.r${rules}.${hash}`;
}
