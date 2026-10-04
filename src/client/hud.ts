/** The in-game HUD and screen feedback (§10), plain DOM over the canvas. */
import type { ClassId } from '../data/classes';
import { ABILITIES, WEAPONS } from '../data/weapons';
import { spriteUrl } from '../render/atlas';
import { fireFrame, weaponAtlas, type WeaponManifest } from '../render/weaponAtlas';

const RECOIL_MS = 120;
const FLASH_MS = 60;
const HIT_MARKER_MS = 100;
const KILL_MARKER_MS = 150;
const VIGNETTE_MS = 300;
const SHAKE_MS = 150;
const JUDGMENT_TEXT_MS = 3000;
const INTERRUPTED_MS = 1000;
const JUDGMENT_FLASH_MS = 600;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent.appendChild(e);
  return e;
}

interface Fade {
  el: HTMLElement;
  start: number;
  duration: number;
  from: number;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly hpBar: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly shieldFill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  /** The weapon and its muzzle flash, moved together by the recoil. */
  private readonly weaponBox: HTMLDivElement;
  private readonly weapon: HTMLDivElement;
  private readonly flash: HTMLImageElement;
  private readonly weaponManifest: WeaponManifest;
  private readonly fireIntervalMs: number;
  private weaponFrame = -2;
  private readonly abilities: Array<{ sweep: HTMLDivElement; text: HTMLDivElement; box: HTMLDivElement }>;
  private readonly hitMarker: HTMLDivElement;
  private readonly killMarker: HTMLDivElement;
  private readonly vignettes: Record<'red' | 'green' | 'blue', HTMLDivElement>;
  private readonly center: HTMLDivElement;
  private readonly remaining: HTMLDivElement;
  private readonly death: HTMLDivElement;
  private readonly result: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossCast: HTMLDivElement;
  private readonly bossCastFill: HTMLDivElement;
  private readonly judgment: HTMLDivElement;
  private readonly judgmentFlash: HTMLDivElement;
  private judgmentUntil = 0;
  private shotAt = -Infinity;
  private hitAt = -Infinity;
  private killAt = -Infinity;
  private shakeAt = -Infinity;
  private centerUntil = 0;
  private readonly fades: Fade[] = [];

  constructor(parent: HTMLElement, classId: ClassId) {
    this.root = el('div', 'hud', parent);
    this.vignettes = {
      red: el('div', 'vignette vignette-red', this.root),
      green: el('div', 'vignette vignette-green', this.root),
      blue: el('div', 'vignette vignette-blue', this.root),
    };
    el('div', 'crosshair', this.root);
    this.hitMarker = el('div', 'marker marker-hit', this.root);
    this.killMarker = el('div', 'marker marker-kill', this.root);

    const hp = el('div', 'hp', this.root);
    this.hpBar = el('div', 'hp-bar', hp);
    this.hpFill = el('div', 'hp-fill', this.hpBar);
    this.shieldFill = el('div', 'shield-fill', this.hpBar);
    this.hpText = el('div', 'hp-text', hp);

    // The weapon frame covers the bottom half of the screen (600 px = 50vh), placed so its
    // screen-center column lies on the screen's center line (§11.1).
    const wa = weaponAtlas(classId);
    const m = wa.manifest;
    const vh = (px: number) => `${(px / m.frameH) * 50}vh`;
    this.weaponManifest = m;
    this.fireIntervalMs = WEAPONS[classId].interval * 1000;
    this.weaponBox = el('div', 'weapon', this.root);
    this.weaponBox.style.left = `calc(50% - ${vh(m.centerX)})`;
    this.weaponBox.style.width = vh(m.frameW);
    this.weapon = el('div', 'weapon-sprite', this.weaponBox);
    this.weapon.style.backgroundImage = `url(${wa.url})`;
    this.weapon.style.backgroundSize = `${vh(m.width)} ${vh(m.height)}`;
    this.flash = el('img', 'muzzle-flash', this.weaponBox);
    this.flash.src = spriteUrl('muzzle-flash');
    this.setWeaponFrame(-1);

    const abil = el('div', 'abilities', this.root);
    this.abilities = (['Q', 'E'] as const).map((key) => {
      const box = el('div', 'ability', abil);
      const icon = el('img', 'ability-icon', box);
      icon.src = spriteUrl(ABILITIES[classId][key].icon);
      const sweep = el('div', 'ability-sweep', box);
      const text = el('div', 'ability-cd', box);
      el('div', 'ability-key', box).textContent = key;
      return { sweep, text, box };
    });

    this.boss = el('div', 'boss', this.root);
    el('div', 'boss-name', this.boss).textContent = 'The Gatekeeper';
    this.bossFill = el('div', 'boss-fill', el('div', 'boss-bar', this.boss));
    this.bossCast = el('div', 'boss-cast', this.boss);
    this.bossCastFill = el('div', 'boss-cast-fill', this.bossCast);
    this.boss.hidden = true;
    this.judgmentFlash = el('div', 'judgment-flash', this.root);
    this.judgment = el('div', 'judgment-text', this.root);
    this.judgment.hidden = true;

    this.remaining = el('div', 'remaining', this.root);
    this.center = el('div', 'center-text', this.root);
    this.death = el('div', 'death-text', this.root);
    this.result = el('div', 'result-text', this.root);
  }

  setHp(hp: number, shield: number, maxHp: number): void {
    const total = Math.max(maxHp, hp + shield);
    this.hpFill.style.width = `${(Math.max(0, hp) / total) * 100}%`;
    this.shieldFill.style.left = `${(Math.max(0, hp) / total) * 100}%`;
    this.shieldFill.style.width = `${(shield / total) * 100}%`;
    this.hpText.textContent = shield > 0 ? `${Math.ceil(hp)} + ${Math.ceil(shield)}` : `${Math.ceil(hp)} / ${maxHp}`;
  }

  /** Displayed cooldowns in seconds and their full lengths. */
  setCooldowns(q: number, qMax: number, e: number, eMax: number): void {
    [
      [q, qMax],
      [e, eMax],
    ].forEach(([cd, max], i) => {
      const a = this.abilities[i];
      const frac = cd > 0 ? Math.min(1, cd / max) : 0;
      a.sweep.style.background = frac > 0 ? `conic-gradient(rgba(10, 6, 4, 0.72) ${frac * 360}deg, transparent 0deg)` : 'none';
      a.text.textContent = cd > 0 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '';
      a.box.classList.toggle('ready', cd <= 0);
    });
  }

  /** Enemies remaining, or null to hide it (shown only while the arena is in combat). */
  setRemaining(n: number | null): void {
    this.remaining.hidden = n === null;
    if (n !== null) this.remaining.textContent = `Enemies remaining: ${n}`;
  }

  /**
   * The Gatekeeper's HP bar, shown while `maxHp` > 0, and the Judgment cast bar under it while
   * `judgment` (progress 0–1) isn't null.
   */
  setBoss(hp: number, maxHp: number, judgment: number | null): void {
    this.boss.hidden = maxHp <= 0;
    if (maxHp <= 0) return;
    this.bossFill.style.width = `${Math.max(0, Math.min(1, hp / maxHp)) * 100}%`;
    this.bossCast.hidden = judgment === null;
    if (judgment !== null) this.bossCastFill.style.width = `${Math.min(1, judgment) * 100}%`;
  }

  /** Judgment feedback (§10): the warning for the 3 s cast, then a white flash or "Interrupted!". */
  judgmentEvent(phase: 'start' | 'interrupted' | 'completed', now: number): void {
    if (phase === 'start') this.showJudgmentText('JUDGMENT — break line of sight!', JUDGMENT_TEXT_MS, now);
    else if (phase === 'interrupted') this.showJudgmentText('Interrupted!', INTERRUPTED_MS, now);
    else {
      this.judgment.hidden = true;
      this.fade(this.judgmentFlash, 1, JUDGMENT_FLASH_MS, now);
    }
  }

  private showJudgmentText(text: string, ms: number, now: number): void {
    this.judgment.textContent = text;
    this.judgment.hidden = false;
    this.judgmentUntil = now + ms;
  }

  shot(now: number): void {
    this.shotAt = now;
  }

  hit(now: number): void {
    this.hitAt = now;
  }

  kill(now: number): void {
    this.killAt = now;
  }

  shakeHp(now: number): void {
    this.shakeAt = now;
  }

  /** A screen-edge vignette that fades out over 300 ms. */
  vignette(color: 'red' | 'green' | 'blue', opacity: number, now: number): void {
    this.fade(this.vignettes[color], opacity, VIGNETTE_MS, now);
  }

  private fade(e: HTMLElement, from: number, duration: number, now: number): void {
    const i = this.fades.findIndex((f) => f.el === e);
    if (i >= 0) this.fades.splice(i, 1);
    this.fades.push({ el: e, start: now, duration, from });
  }

  centerText(text: string, ms: number, now: number): void {
    this.center.textContent = text;
    this.center.hidden = false;
    this.centerUntil = now + ms;
  }

  setDeath(text: string | null): void {
    this.death.hidden = text === null;
    this.death.textContent = text ?? '';
  }

  showResult(text: string): void {
    this.setDeath(null);
    this.result.textContent = text;
    this.result.hidden = false;
  }

  /** Shows fire frame `f` (0–3), or the idle frame for -1, with the flash at its muzzle. */
  private setWeaponFrame(f: number): void {
    if (f === this.weaponFrame) return;
    this.weaponFrame = f;
    const m = this.weaponManifest;
    const [x, y, mx, my] = f < 0 ? m.idle[0] : m.fire[f];
    const vh = (px: number) => `${(px / m.frameH) * 50}vh`;
    this.weapon.style.backgroundPosition = `-${vh(x)} -${vh(y)}`;
    this.flash.style.left = vh(mx);
    this.flash.style.top = vh(my);
  }

  update(now: number): void {
    // Recoil: 8% of the screen height, recovering over 120 ms.
    const r = Math.max(0, 1 - (now - this.shotAt) / RECOIL_MS);
    this.weaponBox.style.transform = `translateY(${r * 8}vh)`;
    this.setWeaponFrame(fireFrame(now - this.shotAt, this.fireIntervalMs));
    this.flash.style.opacity = now - this.shotAt < FLASH_MS ? '1' : '0';
    this.hitMarker.style.opacity = now - this.hitAt < HIT_MARKER_MS ? '1' : '0';
    this.killMarker.style.opacity = now - this.killAt < KILL_MARKER_MS ? '1' : '0';
    const shaking = now - this.shakeAt < SHAKE_MS;
    this.hpBar.style.transform = shaking ? `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 6}px)` : '';
    if (now > this.centerUntil) this.center.hidden = true;
    if (now > this.judgmentUntil) this.judgment.hidden = true;
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const f = this.fades[i];
      const t = (now - f.start) / f.duration;
      if (t >= 1) {
        f.el.style.opacity = '0';
        this.fades.splice(i, 1);
      } else f.el.style.opacity = String(f.from * (1 - t));
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
