/** The in-game HUD and screen feedback (§10), plain DOM over the canvas. */
import type { ClassId } from '../data/classes';
import { ABILITIES, WEAPONS } from '../data/weapons';
import { spriteUrl } from '../render/atlas';

const RECOIL_MS = 120;
const FLASH_MS = 60;
const HIT_MARKER_MS = 100;
const KILL_MARKER_MS = 150;
const VIGNETTE_MS = 300;
const SHAKE_MS = 150;

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
  private readonly weapon: HTMLImageElement;
  private readonly flash: HTMLImageElement;
  private readonly abilities: Array<{ sweep: HTMLDivElement; text: HTMLDivElement; box: HTMLDivElement }>;
  private readonly hitMarker: HTMLDivElement;
  private readonly killMarker: HTMLDivElement;
  private readonly vignettes: Record<'red' | 'green' | 'blue', HTMLDivElement>;
  private readonly center: HTMLDivElement;
  private readonly remaining: HTMLDivElement;
  private readonly death: HTMLDivElement;
  private readonly result: HTMLDivElement;
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

    const weapon = el('div', 'weapon', this.root);
    this.flash = el('img', 'muzzle-flash', weapon);
    this.flash.src = spriteUrl('muzzle-flash');
    this.weapon = el('img', 'weapon-sprite', weapon);
    this.weapon.src = spriteUrl(WEAPONS[classId].sprite);

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
    const v = this.vignettes[color];
    const i = this.fades.findIndex((f) => f.el === v);
    if (i >= 0) this.fades.splice(i, 1);
    this.fades.push({ el: v, start: now, duration: VIGNETTE_MS, from: opacity });
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

  update(now: number): void {
    // Recoil: 8% of the screen height, recovering over 120 ms.
    const r = Math.max(0, 1 - (now - this.shotAt) / RECOIL_MS);
    this.weapon.style.transform = `translateY(${r * 8}vh)`;
    this.flash.style.opacity = now - this.shotAt < FLASH_MS ? '1' : '0';
    this.flash.style.transform = `translateY(${r * 8}vh)`;
    this.hitMarker.style.opacity = now - this.hitAt < HIT_MARKER_MS ? '1' : '0';
    this.killMarker.style.opacity = now - this.killAt < KILL_MARKER_MS ? '1' : '0';
    const shaking = now - this.shakeAt < SHAKE_MS;
    this.hpBar.style.transform = shaking ? `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 6}px)` : '';
    if (now > this.centerUntil) this.center.hidden = true;
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
