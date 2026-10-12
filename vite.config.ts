import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { buildFingerprint, sourceHash } from './buildFingerprint';
import { PROTOCOL_VERSION, RULES_VERSION } from './src/net/version';

function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'nogit';
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  define: {
    __BUILD_VERSION__: JSON.stringify(buildFingerprint(pkg.version, gitShortHash(), PROTOCOL_VERSION, RULES_VERSION,
      sourceHash(fileURLToPath(new URL('.', import.meta.url))))),
  },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 2000 },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
    // The simulation's 8 ms/tick assertion needs an idle CPU, not competing generator/renderer suites.
    maxWorkers: 1,
  },
});
