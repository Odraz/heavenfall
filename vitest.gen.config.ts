import { defineConfig } from 'vitest/config';

/** `npm run test:gen`: the 1 000 pinned generator seeds (rogue game.md §14.9); minutes, so not in `npm test`. */
export default defineConfig({
  test: {
    include: ['src/gen/*.gen.ts'],
    testTimeout: 1_800_000,
  },
});
