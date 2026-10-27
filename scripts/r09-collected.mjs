// Writes docs/rogue/fixtures/r09-collected.txt (R9 stage 3): a normal MG1 profile with every class at
// 49 500 XP (level 10, nine talent points) on its first development build, every chest and deed relic
// owned, the four deeds done and one recorded win (Edicts unlocked). Import it into a normal profile
// for the collected-account sessions. The game's own modules build and encode it, through Vite.
//
//   node scripts/r09-collected.mjs
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { createProfile, validateProfile } = await server.ssrLoadModule('/src/profile/model.ts');
  const { exportCode } = await server.ssrLoadModule('/src/profile/codec.ts');
  const { BASE_ABILITIES, DEV_BUILDS, devBuildOrder } = await server.ssrLoadModule('/src/data/talents.ts');
  const { DEED_IDS, RELIC_IDS } = await server.ssrLoadModule('/src/data/relics.ts');
  const { CLASS_IDS } = await server.ssrLoadModule('/src/data/classes.ts');

  // A fixed identity and clock, so the file only changes when the content does.
  const now = Date.UTC(2026, 9, 27);
  const profile = createProfile('Collected', 'c0ffee09c0ffee09c0ffee09c0ffee09', now);
  for (const c of CLASS_IDS) {
    const build = DEV_BUILDS[devBuildOrder(c)[0]];
    const [q, e] = BASE_ABILITIES[c];
    profile.characters[c] = { ...profile.characters[c], xp: 49_500, talents: [...build.talents], q: build.q ?? q, e: build.e ?? e };
  }
  profile.relics = [...RELIC_IDS];
  profile.deeds = [...DEED_IDS];
  profile.heavens.clears = { 1: 1 };
  profile.stats = { runs: 1, wins: 1 };
  const code = await exportCode(validateProfile(profile).profile);
  writeFileSync('docs/rogue/fixtures/r09-collected.txt', `${code}\n`);
  console.log(`docs/rogue/fixtures/r09-collected.txt: ${code.length} characters`);
} finally {
  await server.close();
}
