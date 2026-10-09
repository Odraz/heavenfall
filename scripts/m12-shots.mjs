// M12 screenshots: the director's F3 readout in each phase, a wave arriving from several sides with its
// spawn points glowing (stage 1), a player caught wading (stage 2), burst deaths seen from the shooter
// (stage 3: `fire:<class>`), and stage 4's class tools: Falling Star's preview, crater and the pieces
// after it (`star`), Blasphemy's stun (`stun`), Shadowstep's streak (`dash`) and its first-person slash
// (`slash`), and stage 5's feedback: the steady shield edge (`shield`), the low-HP edge (`lowhp`) and
// Cherub arrows (`arrow`). Needs a running server (npm run dev or npm run preview).
// Usage: node scripts/m12-shots.mjs [readout|glow|glow-ground|wade|fire:<class>[:right]|star|stun|dash|slash|shield|lowhp|arrow] [base URL, default http://localhost:5173]
// Environment for `fire`: BACK=1 backs away while firing; FREEZE_MS is how long after new bursts the
// frame is frozen and saved (default 90; 0 is the burst's own frame).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [what = 'readout', base = 'http://localhost:5173'] = process.argv.slice(2);
const OUT = 'screenshots/m12';
/** The mouse's position as Playwright tracks it: under pointer lock only the movement counts (stage 4's shots). */
let mouseX = 0;
let mouseY = 0;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text().slice(0, 400)}`);
});

const director = () => page.evaluate(() => window.__heavenfall.director);
const fmt = (d) => (d ? `${d.phase} ${d.phaseTime.toFixed(1)} s · ${Math.round(d.intensity)} · w${d.wave} ${d.alive}/${d.waveTotal}` : 'null');

async function open(query) {
  await page.goto(`${base}/?${query}`);
  await page.waitForFunction(() => window.__heavenfall?.screen === 'inGame', null, { timeout: 60_000 });
  await page.keyboard.press('F3');
}

if (what === 'readout') {
  // The bot plays the Fallen in god mode: its kills close by still raise its intensity, so the
  // director peaks, and the run doesn't end in a defeat.
  await open('dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1&cam=26,21.5,24,0,-38');
  const shot = new Set();
  const t0 = Date.now();
  let last = '';
  while (shot.size < 3 && Date.now() - t0 < 420_000) {
    const d = await director();
    const line = fmt(d);
    if (d && d.phase !== last.split(' ')[0]) console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s: ${line}`);
    last = d ? line : '';
    // Each phase once it has run a moment, so its time shows.
    if (d && !shot.has(d.phase) && d.phase !== 'done' && d.phaseTime >= 1.5 && (d.phase !== 'build' || d.wave >= 1)) {
      await page.screenshot({ path: `${OUT}/director-${d.phase}.png` });
      console.log(`saved director-${d.phase}.png (${line})`);
      shot.add(d.phase);
    }
    if ((await page.evaluate(() => window.__heavenfall.gameResult)) !== null) break;
    await page.waitForTimeout(250);
  }
  console.log(`phases shot: ${[...shot].join(', ')}`);
} else if (what === 'wade') {
  // Stage 2: the Binder bot (6 m/s) in god mode, caught by three or more Blessed (M12 §3.1).
  await open('dev=1&map=pearly-gates&class=binder&bot=1&god=1&seed=1');
  const t0 = Date.now();
  let max = 0;
  let shot = false;
  while (!shot && Date.now() - t0 < 300_000) {
    const w = await page.evaluate(() => window.__heavenfall.wade);
    max = Math.max(max, w.count);
    if (w.count >= 3 && w.factor < 0.6) {
      await page.screenshot({ path: `${OUT}/wading-caught.png` });
      console.log(`saved wading-caught.png (${w.count} pressing, ×${w.factor.toFixed(2)})`);
      shot = true;
    }
    await page.waitForTimeout(100);
  }
  if (!shot) console.log(`never caught by 3; most pressing at once: ${max}`);
} else if (what.startsWith('fire:')) {
  // Stage 3: a real player in god mode walks into Arena 1 and holds a mouse button facing the arena
  // (`fire:<class>[:right][:<turn px>]`); each time new burst deaths play, the game loop freezes `FREEZE_MS`
  // later, so the frame shows the bodies blasted and the pieces flying.
  const [, cls, button = 'left', turn = '0'] = what.split(':');
  await open(`dev=1&map=pearly-gates&class=${cls}&god=1&seed=1`);
  await page.keyboard.press('F3');
  const canvas = (await page.locator('canvas').first().boundingBox()) ?? { x: 0, y: 0, width: 1280, height: 720 };
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(cx, cy);
    if (await page.evaluate(() => document.pointerLockElement !== null)) break;
    await page.waitForTimeout(500);
  }
  // From the spawn, a little to the right and down the passage into the Courtyard, which seals.
  await page.mouse.move(cx + 85, cy, { steps: 10 });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__heavenfall.arenaPhase !== 'idle', null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  if (Number(turn)) await page.mouse.move(cx + 85 + Number(turn), cy, { steps: 8 });
  await page.mouse.down({ button: button === 'right' ? 'right' : 'left' });
  // BACK=1: back away while firing, so the crowd follows at a distance instead of swarming the camera.
  if (process.env.BACK === '1') await page.keyboard.down('KeyS');
  const FREEZE_MS = Number(process.env.FREEZE_MS ?? 90);
  const t0 = Date.now();
  let n = 0;
  while (n < 6 && Date.now() - t0 < 240_000) {
    // In the page: wait for at least `k` new burst deaths, then stop the loop FREEZE_MS later.
    const k = n < 3 ? 1 : 3;
    const got = await page.evaluate(([k, ms]) => new Promise((resolve) => {
      const raf = window.requestAnimationFrame.bind(window);
      const total = () => window.__heavenfall.bursts.light + window.__heavenfall.bursts.heavy;
      const start = total();
      const t0 = performance.now();
      let seen = -1;
      const watch = (now) => {
        if (seen < 0 && total() - start >= k) seen = now;
        if (seen >= 0 && now - seen >= ms) {
          window.__resume = window.requestAnimationFrame;
          window.requestAnimationFrame = (cb) => {
            window.__pendingFrame = cb;
            return 0;
          };
          window.__origRaf = raf;
          resolve(total() - start);
          return;
        }
        if (now - t0 > 20_000) return resolve(0);
        raf(watch);
      };
      raf(watch);
    }), [k, FREEZE_MS]);
    if (!got) console.log(`no bursts yet: ${await page.evaluate(() => JSON.stringify({ phase: window.__heavenfall.arenaPhase, enemies: window.__heavenfall.enemies, kills: window.__heavenfall.players[0]?.kills, shots: window.__heavenfall.players[0]?.primaryShots, locked: document.pointerLockElement !== null }))}`);
    if (got) {
      await page.waitForTimeout(150);
      const name = `fire-${cls}${button === 'right' ? '-rmb' : ''}-${n}.png`;
      await page.screenshot({ path: `${OUT}/${name}` });
      const b = await page.evaluate(() => window.__heavenfall.bursts);
      console.log(`saved ${name} (+${got}: light ${b.light}, heavy ${b.heavy}, mass kills ${b.massKills})`);
      n++;
    }
    // Resume the loop.
    await page.evaluate(() => {
      if (!window.__origRaf) return;
      window.requestAnimationFrame = window.__origRaf;
      const cb = window.__pendingFrame;
      window.__origRaf = undefined;
      if (cb) window.requestAnimationFrame(cb);
    });
    await page.waitForTimeout(1200);
  }
  await page.mouse.up({ button: button === 'right' ? 'right' : 'left' });
} else if (['star', 'stun', 'dash', 'slash'].includes(what)) {
  await stage4(what);
} else if (['shield', 'lowhp', 'arrow'].includes(what)) {
  await stage5(what);
} else {
  // A fixed camera high over the Courtyard's west entry, looking east over the arena, or at eye height
  // on the terrace's west stairs (glow-ground); the bot fights below.
  const ground = what === 'glow-ground';
  const cam = ground ? '30,21.5,,0,4' : '26,21.5,24,0,-38';
  await open(`dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1&cam=${cam}`);
  const t0 = Date.now();
  let n = 0;
  while (n < 4 && Date.now() - t0 < 300_000) {
    const d = await director();
    // Wave 2 and later, a few seconds into its arrival.
    if (d && d.phase === 'build' && d.wave >= 1 && d.phaseTime >= 2 + n * 1.5 && d.alive < d.waveTotal) {
      const name = `wave-arriving${ground ? '-ground' : ''}-${n}.png`;
      await page.screenshot({ path: `${OUT}/${name}` });
      console.log(`saved ${name} (${fmt(d)})`);
      n++;
    }
    await page.waitForTimeout(100);
  }
}
await browser.close();

/** Stops the game loop: the next frame waits until `step` runs it at a chosen time. */
async function freeze() {
  await page.evaluate(() => {
    window.__origRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      window.__pendingFrame = cb;
      return 0;
    };
  });
  await page.waitForTimeout(100);
}

/** Runs the waiting frame at `at` (performance.now() time). */
async function step(at) {
  await page.evaluate((t) => {
    const cb = window.__pendingFrame;
    window.__pendingFrame = undefined;
    if (cb) cb(t);
  }, at);
}

async function unfreeze() {
  await page.evaluate(() => {
    if (!window.__origRaf) return;
    window.requestAnimationFrame = window.__origRaf;
    const cb = window.__pendingFrame;
    window.__origRaf = undefined;
    if (cb) window.requestAnimationFrame(cb);
  });
}

/** Saves a screenshot and says so. */
async function shot(name, note = '') {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`saved ${name}.png${note ? ` (${note})` : ''}`);
}


/** Turns the view to an absolute yaw and pitch (degrees, simulation angles), by mouse movement (0.0022 rad per px). */
async function lookAt(yawDeg, pitchDeg) {
  for (let i = 0; i < 3; i++) {
    const v = await page.evaluate(() => window.__heavenfall.self);
    const dyaw = ((yawDeg - (v.yaw * 180) / Math.PI + 540) % 360) - 180;
    const dpitch = pitchDeg - (v.pitch * 180) / Math.PI;
    if (Math.abs(dyaw) < 0.3 && Math.abs(dpitch) < 0.3) return;
    mouseX += ((dyaw * Math.PI) / 180) / 0.0022;
    mouseY -= ((dpitch * Math.PI) / 180) / 0.0022;
    await page.mouse.move(mouseX, mouseY, { steps: 4 });
    await page.waitForTimeout(80);
  }
}

/** Waits until at least `n` enemies are within 8 m of the local player, up to `ms`; returns how many. */
async function crowdNear(n, ms) {
  const t0 = Date.now();
  for (;;) {
    const k = await page.evaluate(() => window.__heavenfall.near);
    if (k >= n || Date.now() - t0 > ms) return k;
    await page.waitForTimeout(150);
  }
}

/** Stage 4's shots (M12 §5): a real player in god mode in the Courtyard. */
async function stage4(kind) {
  const cls = kind === 'dash' || kind === 'slash' ? 'betrayer' : 'fallen';
  await open(`dev=1&map=pearly-gates&class=${cls}&god=1&seed=1`);
  await page.keyboard.press('F3');
  const canvas = (await page.locator('canvas').first().boundingBox()) ?? { x: 0, y: 0, width: 1280, height: 720 };
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(cx, cy);
    if (await page.evaluate(() => document.pointerLockElement !== null)) break;
    await page.waitForTimeout(500);
  }
  // Into the Courtyard, which seals, as `fire` does.
  await page.mouse.move(cx + 85, cy, { steps: 10 });
  [mouseX, mouseY] = [cx + 85, cy];
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__heavenfall.arenaPhase !== 'idle', null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');

  if (kind === 'slash') {
    // The slash at its start, middle and end, the loop stepped at those times: 30 ms (faded in), 100 and
    // 170 ms (before it fades out over the last 40).
    await page.waitForTimeout(1500);
    await freeze();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__heavenfall.slashAt > 0);
    const t0 = await page.evaluate(() => window.__heavenfall.slashAt);
    for (const [t, name] of [[30, 'start'], [100, 'middle'], [170, 'end']]) {
      await step(t0 + t);
      await page.waitForTimeout(150);
      await shot(`slash-${name}`, `${t} ms into the slash`);
    }
    // The smear fading after it.
    await step(t0 + 240);
    await page.waitForTimeout(150);
    await shot('slash-after', '40 ms after the slash: the smear fading, the revolver rising');
    await unfreeze();
    return;
  }

  if (kind === 'dash') {
    // A dash through the crowd once it's close, aimed at its centroid. The view faces 135° away from it
    // and the dash goes back-right (S + D), so the streak, drawn as it ends and fading over 250 ms, is in
    // view at once from its end.
    const near = await crowdNear(8, 60_000);
    console.log(`${near} enemies within 8 m`);
    const toCrowd = await page.evaluate(() => (window.__heavenfall.nearYaw * 180) / Math.PI);
    await lookAt(toCrowd - 135, -15);
    const before = await page.evaluate(() => window.__heavenfall.players[0]?.kills ?? 0);
    await page.keyboard.down('KeyS');
    await page.keyboard.down('KeyD');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyD');
    const t0 = await page.evaluate(() => window.__heavenfall.slashAt);
    // The dash moves by frame time (at most 50 ms a frame), so a slow headless page ends it late.
    await page.waitForFunction((t) => window.__heavenfall.streakAt >= t && performance.now() - window.__heavenfall.streakAt >= 50, t0, { polling: 10 });
    await freeze();
    await shot('dash-streak', 'the streak 70 ms after the dash, seen from the side');
    await unfreeze();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => window.__heavenfall.players[0]?.kills ?? 0);
    console.log(`kills by the dash: ${after - before}`);
    return;
  }

  if (kind === 'stun') {
    const near = await crowdNear(8, 60_000);
    console.log(`${near} enemies within 8 m`);
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(350);
    await freeze();
    await shot('stun', 'Blasphemy 350 ms ago: the crowd stunned, red and recoiling');
    await unfreeze();
    return;
  }

  // Falling Star (`star`): the preview onto the floor ahead, as a slam at the feet, over a wall (the
  // 30 m point behind it) and onto the Gatekeeper's dais; then a crater on the crowd and the pieces after it.
  const yaw0 = await page.evaluate(() => (window.__heavenfall.self.yaw * 180) / Math.PI);
  const ready = () => page.waitForFunction(() => document.querySelectorAll('.ability')[1]?.textContent?.trim() === 'E', null, { timeout: 15_000 }).catch(() => {});
  /** Holds E at an aim, saves the preview, then cancels with the right button. */
  const preview = async (name, yaw, pitch) => {
    await lookAt(yaw, pitch);
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => window.__heavenfall.star);
    await shot(name, st ? `landing (${st.x.toFixed(1)}, ${st.y.toFixed(1)}, ${st.z.toFixed(1)}) ${st.valid ? 'valid' : 'invalid'}` : 'no preview');
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(100);
    await page.keyboard.up('KeyE');
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(150);
    return st;
  };
  await preview('star-valid-floor', yaw0, -9);
  await preview('star-valid-slam', yaw0, -75);
  // Over a wall: turn until the 30 m point, aimed 30° up, is invalid.
  for (let d = 30; d <= 330; d += 30) {
    await lookAt(yaw0 + d, 30);
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(250);
    const st = await page.evaluate(() => window.__heavenfall.star);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(80);
    await page.keyboard.up('KeyE');
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(100);
    if (st && !st.valid) {
      await preview('star-invalid-wall', yaw0 + d, 30);
      break;
    }
  }
  // The crater: further into the Courtyard, when the crowd is close, a leap 4 m toward it, the view
  // turned level for the landing.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const near = await crowdNear(12, 90_000);
  console.log(`${near} enemies within 8 m`);
  const toCrowd = await page.evaluate(() => (window.__heavenfall.nearYaw * 180) / Math.PI);
  await lookAt(toCrowd, -22);
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__heavenfall.bursts.heavy);
  await page.keyboard.up('KeyE');
  await page.waitForTimeout(60);
  await lookAt(toCrowd, -8);
  await page.waitForFunction((b) => window.__heavenfall.bursts.heavy > b + 3, before, { timeout: 5_000 }).catch(() => console.log('few heavy bursts after the leap'));
  await page.waitForTimeout(60);
  await freeze();
  const b = await page.evaluate(() => window.__heavenfall.bursts);
  await shot('star-crater', `bursts light ${b.light}, heavy ${b.heavy}`);
  await unfreeze();
  // The pieces on the floor around the landing, looking down while the crowd is still knocked back 4 m.
  await page.waitForTimeout(350);
  await lookAt(toCrowd, -45);
  await page.waitForTimeout(100);
  await freeze();
  await shot('star-pieces', 'the pieces lying after the crater');
  await unfreeze();
  // The dais, from the boss arena's 7.5 m south terrace, once Falling Star is ready again.
  // Aimed at its east part, past the pillars.
  await page.evaluate(() => window.__heavenfallTeleport?.(28.5, 92.5));
  await page.waitForTimeout(800);
  await ready();
  await page.waitForTimeout(10_500);
  const dyaw = (Math.atan2(78.5 - 92.5, 14.5 - 28.5) * 180) / Math.PI;
  await preview('star-invalid-dais', dyaw, -4.6);
}

/** Stage 5's shots (M12 §6): a real player, in the Courtyard or the sandbox's arena. */
async function stage5(kind) {
  const query = {
    shield: 'dev=1&map=pearly-gates&class=heretic&god=1&seed=1',
    // Not invulnerable until HP is low, then dev key G.
    lowhp: 'dev=1&map=pearly-gates&class=betrayer&seed=1',
    arrow: 'dev=1&map=sandbox&class=betrayer&god=1&seed=1',
  }[kind];
  await open(query);
  await page.keyboard.press('F3');
  const canvas = (await page.locator('canvas').first().boundingBox()) ?? { x: 0, y: 0, width: 1280, height: 720 };
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(cx, cy);
    if (await page.evaluate(() => document.pointerLockElement !== null)) break;
    await page.waitForTimeout(500);
  }
  [mouseX, mouseY] = [cx, cy];
  if (kind === 'arrow') {
    // Into the sandbox's arena, facing east across it.
    await page.evaluate(() => window.__heavenfallTeleport?.(22.5, 7.5));
  } else {
    await page.mouse.move(cx + 85, cy, { steps: 10 });
    [mouseX, mouseY] = [cx + 85, cy];
    await page.keyboard.down('KeyW');
  }
  await page.waitForFunction(() => window.__heavenfall.arenaPhase !== 'idle', null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');

  if (kind === 'shield') {
    // Martyr's Shroud on itself (no ally aimed): the steady blue edge once the flash has faded.
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(900);
    await shot('shield-edge', 'own shield up, the flash faded');
    return;
  }
  if (kind === 'lowhp') {
    const t0 = Date.now();
    while (Date.now() - t0 < 120_000) {
      const hp = await page.evaluate(() => window.__heavenfall.players[0]?.hp ?? 120);
      if (hp < 0.33 * 120) break;
      await page.waitForTimeout(50);
    }
    await page.keyboard.press('KeyG');
    const hp = await page.evaluate(() => window.__heavenfall.players[0]?.hp);
    await page.waitForTimeout(400);
    await shot('lowhp-edge', `HP ${hp} of 120, dev key G pressed`);
    await page.waitForTimeout(250);
    await shot('lowhp-edge-1');
    return;
  }
  // Cherub arrows among the gold bursts: circling the crowd (strafing left, turned toward it) while
  // firing into it, so the Cherubs shoot from range; candidate frames, the one with the most of the
  // arrows' cyan picked afterwards (nothing else in the world is cyan).
  await page.mouse.down();
  await page.keyboard.down('KeyA');
  for (let n = 0; n < 36; n++) {
    const yaw = await page.evaluate(() => (window.__heavenfall.near ? (window.__heavenfall.nearYaw * 180) / Math.PI : null));
    if (yaw !== null) await lookAt(yaw, 8);
    await page.waitForTimeout(250);
    await freeze();
    await page.screenshot({ path: `${OUT}/arrow-cand-${n}.png` });
    await unfreeze();
  }
  await page.keyboard.up('KeyA');
  await page.mouse.up();
  console.log('saved arrow-cand-0..35.png');
}
