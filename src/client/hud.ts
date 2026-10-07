/** The in-game HUD and screen feedback (§10), plain DOM over the canvas. */
import { CLASSES, GENERAL_HINTS, type ClassId } from '../data/classes';
import { ABILITIES, WEAPONS } from '../data/weapons';
import { mouseGlyph } from '../ui/mouseGlyph';
import { CHAT_MAX } from '../net/lobby';
import { spriteUrl } from '../render/atlas';
import { weaponArt, type ViewBox, type WeaponLayer, type WeaponManifest } from '../render/weaponAtlas';
import { altLevel, cylinderBlur, recoilLeft, swingPose, glowLevel, hammerAngle, HealFade, layerOpacities, recoilTilt, Sway, Tilt, transformPoint, VH_PER_PX, WeaponLight } from './fpWeapon';

/** Recoil in % of the screen height (MVP §10; the slug and the Silver Bullet kick harder, M9 §5.1). */
const RECOIL_PCT = 8;
/** The weapon dims in shade (M11 §3.5); a switch kept from the gate's cut 2, which didn't help (M11 §5). */
const WEAPON_LIGHT = true;
/** The Field of Blood's rising glow pulses over 1.2 s and flares for 0.3 s on entering (M9 §5.1). */
const FIELD_PULSE_MS = 1200;
const FIELD_FLARE_MS = 300;
const FLASH_MS = 60;
const HIT_MARKER_MS = 80;
const KILL_MARKER_MS = 120;
/** The hit and kill markers' ticks, in degrees around the crosshair (M8 §3.2). */
const MARKER_TICKS = [45, 135, 225, 315];
const SVG_NS = 'http://www.w3.org/2000/svg';
/** Ready glint (M8 §2.3): the band's sweep and the slot frame's gold glow. */
const GLINT_SWEEP_MS = 400;
const GLINT_GLOW_MS = 300;
/** The ability slots' cooldown ring (M9 §6.4): 24 px radius, 3 px stroke, centered on the 64 px slot. */
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;
/** The Field of Blood buff icon's ring, around its 32 px icon. */
const BUFF_R = 17;
const BUFF_C = 2 * Math.PI * BUFF_R;
const VIGNETTE_MS = 300;
const SHAKE_MS = 150;
const JUDGMENT_TEXT_MS = 3000;
const INTERRUPTED_MS = 1000;
const JUDGMENT_FLASH_MS = 600;
/** Chat messages (M8 §7) show for 10 s, fading over the last 1 s, at most 6 at once. */
const CHAT_SHOW_MS = 10000;
const CHAT_FADE_MS = 1000;
const CHAT_LINES = 6;

/** View pixels (M11 §1) as a CSS length. */
function vh(px: number): string {
  return `${(px * VH_PER_PX).toFixed(4)}vh`;
}

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
  /**
   * The painted weapon (M11 §3): its box, placed by the manifest and moved by one transform, holding the
   * idle image, the alt image, the hammer, the cylinder blur, the green censer and the glow layers. The
   * muzzle flash is drawn behind it, at its transformed muzzle.
   */
  private readonly weaponBox: HTMLDivElement;
  private readonly layers: Partial<Record<WeaponLayer, HTMLImageElement>> = {};
  private readonly flash: HTMLImageElement;
  private readonly weaponManifest: WeaponManifest;
  /** The last shot's interval, recoil and muzzle flash scale (M9 §5.1), and its tilt (M11 §3.2). */
  private fireIntervalMs: number;
  private recoilPct = RECOIL_PCT;
  private flashOn = true;
  private readonly tilt = new Tilt();
  /** The weapon's lag behind the view's turning (M11 §3.2), its brightness in shade (§3.5), the green censer (§3.9). */
  readonly sway = new Sway();
  private readonly light = new WeaponLight();
  private brightness = 1;
  private fieldFilter = '';
  private readonly heal = new HealFade();
  /** The last values written per style, so an unchanged one isn't rewritten. */
  private readonly written = new Map<string, string>();
  /**
   * The Scourge (M11 §3.6): the chain's frames (one image, its glow screened over it) and the painted fist
   * over them where the hand is, drawn over the Chain Gun while the swing plays.
   */
  private readonly swingChain: HTMLDivElement | null = null;
  private readonly swingFist: HTMLImageElement | null = null;
  private readonly swingLayers: HTMLImageElement[] = [];
  private swingAt = -Infinity;
  private swingFrame = -2;
  /** A steady green vignette while a Sacrament beam heals the player (M9 §5.1). */
  private readonly beamVignette: HTMLDivElement;
  /** Standing in a Field of Blood (M9 §5.1): the rising glow, the weapon's red glow, the red crosshair. */
  private readonly fieldGlow: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private inField = false;
  private fieldEnteredAt = -Infinity;
  private readonly abilities: Array<{ arc: SVGCircleElement; text: HTMLDivElement; box: HTMLDivElement; glint: HTMLDivElement; cd: number }>;
  /** The hints panel (M8 §2.2), toggled with H. */
  private readonly hints: HTMLDivElement;
  /**
   * The bottom-left column (M9 §6.4), from the bottom up: the own frame, the party frames, the chat.
   * The party frames go in before `ownFrame`.
   */
  readonly leftColumn: HTMLDivElement;
  readonly ownFrame: HTMLDivElement;
  /** The Field of Blood buff icon by the HP bar, with its ring emptying over the field's time (M9 §5.1). */
  private readonly buff: HTMLDivElement;
  private readonly buffArc: SVGCircleElement;
  /** Called when an ability's cooldown runs out, for its sound (M8 §2.3). */
  onReady: (slot: 'Q' | 'E') => void = () => {};
  private readonly hitMarker: HTMLDivElement;
  private readonly killMarker: HTMLDivElement;
  private readonly vignettes: Record<'red' | 'green' | 'blue', HTMLDivElement>;
  private readonly center: HTMLDivElement;
  private readonly remaining: HTMLDivElement;
  private readonly death: HTMLDivElement;
  private readonly deathMain: HTMLDivElement;
  private readonly deathSub: HTMLDivElement;
  /** The dead player's own revive progress (M8 §4.5). */
  private readonly deathBar: HTMLDivElement;
  private readonly deathFill: HTMLDivElement;
  /** The joined-as-soul screen's ember vignette (M8 §4.5). */
  private readonly emberVignette: HTMLDivElement;
  /** The arena countdown (M8 §5): a top-center line, and a large number in the last 5 s. */
  private readonly countdownLine: HTMLDivElement;
  private readonly countdownBig: HTMLDivElement;
  /** Soul markers (M8 §4.1), by player ID. */
  private readonly souls = new Map<number, { root: HTMLDivElement; fill: HTMLDivElement }>();
  private readonly soulLayer: HTMLDivElement;
  private readonly result: HTMLDivElement;
  private readonly boss: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossCast: HTMLDivElement;
  private readonly bossCastFill: HTMLDivElement;
  private readonly judgment: HTMLDivElement;
  private readonly judgmentFlash: HTMLDivElement;
  /** The ally target's chevron (M8 §3.5): gold over the target, grey over an ally out of range. */
  private readonly chevron: HTMLDivElement;
  /** Chat (M8 §7): the messages shown, oldest first, and the chat line. */
  private readonly chatMessages: HTMLDivElement;
  private readonly chatShown: Array<{ el: HTMLDivElement; at: number }> = [];
  private readonly chatInput: HTMLInputElement;
  private chatClosed: (() => void) | null = null;
  /** Called with the text when Enter sends a non-empty chat line. */
  onChatSend: (text: string) => void = () => {};
  /** Weapon bob offset in vh (M8 §3.4). */
  private bobX = 0;
  private bobY = 0;
  private flashRotate = 0;
  private flashScale = 1;
  private judgmentUntil = 0;
  private shotAt = -Infinity;
  private hitAt = -Infinity;
  private killAt = -Infinity;
  private shakeAt = -Infinity;
  private centerUntil = 0;
  private readonly fades: Fade[] = [];

  constructor(parent: HTMLElement, classId: ClassId, multiplayer: boolean) {
    this.root = el('div', 'hud', parent);
    // The weapon first, under every other HUD element (M11 §3.7). The muzzle flash is behind the weapon,
    // outside its box so its screen blend reaches the game view (M8 §3.3).
    const art = weaponArt(classId);
    const m = art.manifest;
    this.weaponManifest = m;
    this.fireIntervalMs = WEAPONS[classId].interval * 1000;
    this.flash = el('img', 'muzzle-flash', this.root);
    this.flash.src = spriteUrl('muzzle-flash');
    this.flash.alt = '';
    this.weaponBox = el('div', 'weapon', this.root);
    const box = this.weaponBox.style;
    box.left = `calc(50% + ${vh(m.left)})`;
    box.top = vh(m.top);
    box.width = vh(m.w);
    box.height = vh(m.h);
    box.transformOrigin = `${vh(m.pivot[0] - m.left)} ${vh(m.pivot[1] - m.top)}`;
    const layer = (name: WeaponLayer, at?: ViewBox, blend = false): HTMLImageElement => {
      const img = el('img', blend ? 'weapon-layer weapon-glow' : 'weapon-layer', this.weaponBox);
      img.src = art.url(name);
      img.alt = '';
      img.draggable = false;
      if (at) Object.assign(img.style, { left: vh(at.x), top: vh(at.y), width: vh(at.w), height: vh(at.h) });
      // Decoded now: the layers first shown by a shot (the alt frame, the green censer) would stall it.
      img.decode().catch(() => {});
      this.layers[name] = img;
      return img;
    };
    layer('idle');
    if (m.alt) layer('alt');
    if (m.hammer) layer('hammer', m.hammer).style.transformOrigin = `${vh(m.hammer.hinge[0] - m.hammer.x)} ${vh(m.hammer.hinge[1] - m.hammer.y)}`;
    if (m.cylinder) layer('cylinder', m.cylinder);
    if (m.heal) layer('censer-green', m.heal);
    if (m.glow) layer('idle-glow', undefined, true);
    if (m.alt?.glow) layer('alt-glow', undefined, true);
    if (m.heal) layer('censer-green-glow', m.heal, true);
    if (m.swing) {
      const sw = m.swing;
      this.swingChain = el('div', 'weapon-swing', this.root);
      Object.assign(this.swingChain.style, { left: `calc(50% + ${vh(sw.chain.left)})`, top: vh(sw.chain.top), width: vh(sw.chain.w), height: vh(sw.chain.h) });
      // The frames stacked in one image, shown one at a time through the box (it clips the rest).
      for (const [name, cls] of [['chain', 'swing-strip'], ['chain-glow', 'swing-strip weapon-glow']] as const) {
        const strip = el('img', cls, this.swingChain);
        strip.src = art.url(name);
        strip.alt = '';
        strip.draggable = false;
        strip.style.height = `${sw.chain.frames * 100}%`;
        this.swingLayers.push(strip);
      }
      this.swingFist = el('img', 'weapon-swing', this.root);
      this.swingFist.src = art.url('fist');
      this.swingFist.alt = '';
      this.swingFist.draggable = false;
      Object.assign(this.swingFist.style, { width: vh(sw.fist.w), height: vh(sw.fist.h), transformOrigin: `${vh(sw.fist.center[0])} ${vh(sw.fist.center[1])}` });
      this.swingChain.hidden = true;
      this.swingFist.hidden = true;
      // Decoded now, not on the first swing: the chain's frames decoding then stalled it by 100 ms.
      for (const img of [...this.swingLayers, this.swingFist]) img.decode().catch(() => {});
    }

    this.vignettes = {
      red: el('div', 'vignette vignette-red', this.root),
      green: el('div', 'vignette vignette-green', this.root),
      blue: el('div', 'vignette vignette-blue', this.root),
    };
    this.beamVignette = el('div', 'vignette vignette-green', this.root);
    this.fieldGlow = el('div', 'field-glow', this.root);
    this.crosshair = el('div', 'crosshair', this.root);
    this.hitMarker = this.marker('marker-hit');
    this.killMarker = this.marker('marker-kill');
    this.chevron = el('div', 'ally-chevron', this.root);
    this.chevron.hidden = true;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 18 13');
    for (const cls of ['chevron-outline', 'chevron-fill']) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M2.5 2.5 L9 10 L15.5 2.5');
      path.setAttribute('class', cls);
      svg.appendChild(path);
    }
    this.chevron.appendChild(svg);

    // The bottom-left column (M9 §6.4): chat on top, then the party frames, then the own frame.
    this.leftColumn = el('div', 'hud-left', this.root);
    const chat = el('div', 'chat', this.leftColumn);
    this.chatMessages = el('div', 'chat-messages', chat);
    this.chatInput = el('input', 'chat-input', chat);
    this.chatInput.maxLength = CHAT_MAX;
    this.chatInput.autocomplete = 'off';
    this.chatInput.spellcheck = false;
    this.chatInput.setAttribute('aria-label', 'Chat');
    this.chatInput.hidden = true;
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      // Not a game key: the line closes here, so the Enter mustn't open it again.
      e.stopPropagation();
      e.preventDefault();
      const text = this.chatInput.value.trim();
      this.closeChat();
      // Enter on an empty line just closes it.
      if (text) this.onChatSend(text);
    });
    this.chatInput.addEventListener('blur', () => {
      if (!this.chatInput.hidden) queueMicrotask(() => this.chatInput.focus());
    });

    // The own frame: the class portrait in the slot frame, and the HP text over the HP bar.
    this.ownFrame = el('div', 'own-frame', this.leftColumn);
    const portrait = el('div', 'own-portrait', this.ownFrame);
    const portraitImg = el('img', '', portrait);
    portraitImg.src = spriteUrl(`class-${classId}`);
    portraitImg.alt = CLASSES[classId].name;
    const hp = el('div', 'hp', this.ownFrame);
    this.hpText = el('div', 'hp-text', hp);
    this.hpBar = el('div', 'hp-bar', hp);
    this.hpFill = el('div', 'hp-fill', this.hpBar);
    this.shieldFill = el('div', 'shield-fill', this.hpBar);
    this.buff = el('div', 'buff-icon', hp);
    this.buff.hidden = true;
    const buffImg = el('img', '', this.buff);
    buffImg.src = spriteUrl('icon-field-of-blood');
    buffImg.alt = 'Field of Blood';
    const buffSvg = document.createElementNS(SVG_NS, 'svg');
    buffSvg.setAttribute('viewBox', '0 0 40 40');
    this.buffArc = document.createElementNS(SVG_NS, 'circle');
    for (const [k, v] of Object.entries({ cx: '20', cy: '20', r: String(BUFF_R), transform: 'rotate(-90 20 20)', 'stroke-dasharray': `${BUFF_C} ${BUFF_C}` })) this.buffArc.setAttribute(k, v);
    buffSvg.appendChild(this.buffArc);
    this.buff.appendChild(buffSvg);

    const abil = el('div', 'abilities', this.root);
    this.abilities = (['Q', 'E'] as const).map((key) => {
      const box = el('div', 'ability', abil);
      const icon = el('img', 'ability-icon', box);
      icon.src = spriteUrl(ABILITIES[classId][key].icon);
      // The glint's band, clipped to the icon.
      const glint = el('div', 'ability-glint-band', el('div', 'ability-glint', box));
      // The cooldown ring (M9 §6.4): a faint track, and a gold arc from 12 o'clock, clockwise, over the
      // part of the cooldown that has passed.
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'ability-ring');
      svg.setAttribute('viewBox', '0 0 64 64');
      const circle = (cls: string): SVGCircleElement => {
        const c = document.createElementNS(SVG_NS, 'circle');
        for (const [k, v] of Object.entries({ cx: '32', cy: '32', r: String(RING_R), class: cls })) c.setAttribute(k, v);
        svg.appendChild(c);
        return c;
      };
      circle('ability-ring-track');
      const arc = circle('ability-ring-arc');
      arc.setAttribute('transform', 'rotate(-90 32 32)');
      box.appendChild(svg);
      const text = el('div', 'ability-cd', box);
      el('div', 'ability-key', box).textContent = key;
      return { arc, text, box, glint, cd: 0 };
    });

    // Hints: the class's lines, each ability's with its icon, then the general ones in multiplayer.
    this.hints = el('div', 'hints', this.root);
    this.hints.hidden = true;
    for (const h of CLASSES[classId].hints) {
      const line = el('div', 'hint', this.hints);
      if (h.key === 'LMB' || h.key === 'RMB') {
        // Attack lines show the mouse glyph where ability lines show their icon (M9 §6.2).
        el('span', 'hint-icon hint-glyph', line).appendChild(mouseGlyph(h.key === 'LMB' ? 'left' : 'right', 18, 24));
      } else if (h.key) {
        const icon = el('img', 'hint-icon', line);
        icon.src = spriteUrl(ABILITIES[classId][h.key].icon);
        icon.alt = h.key;
      } else el('span', 'hint-icon', line);
      el('span', 'hint-text', line).textContent = h.text;
    }
    if (multiplayer) {
      for (const text of GENERAL_HINTS) {
        const line = el('div', 'hint hint-general', this.hints);
        el('span', 'hint-icon', line);
        el('span', 'hint-text', line).textContent = text;
      }
    }

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
    this.soulLayer = el('div', 'soul-markers', this.root);
    this.emberVignette = el('div', 'vignette vignette-ember', this.root);
    this.emberVignette.hidden = true;
    this.death = el('div', 'death-text', this.root);
    this.deathMain = el('div', 'death-main', this.death);
    this.deathSub = el('div', 'death-sub', this.death);
    this.deathBar = el('div', 'death-bar', this.death);
    this.deathFill = el('div', 'death-fill', this.deathBar);
    this.countdownLine = el('div', 'countdown-line', this.root);
    this.countdownLine.hidden = true;
    this.countdownBig = el('div', 'countdown-big', this.root);
    this.countdownBig.hidden = true;
    this.result = el('div', 'result-text', this.root);
  }

  setHp(hp: number, shield: number, maxHp: number): void {
    const total = Math.max(maxHp, hp + shield);
    this.hpFill.style.width = `${(Math.max(0, hp) / total) * 100}%`;
    this.shieldFill.style.left = `${(Math.max(0, hp) / total) * 100}%`;
    this.shieldFill.style.width = `${(shield / total) * 100}%`;
    this.hpText.textContent = shield > 0 ? `HP ${Math.ceil(hp)} + ${Math.ceil(shield)}` : `HP ${Math.ceil(hp)} / ${maxHp}`;
  }

  /**
   * The Field of Blood buff icon (M9 §5.1), shown while the player is in a field: `left` is the
   * fraction of the field's time remaining, which its red ring shows; null hides it.
   */
  setFieldBuff(left: number | null): void {
    this.buff.hidden = left === null;
    if (left !== null) this.buffArc.setAttribute('stroke-dasharray', `${(BUFF_C * Math.max(0, Math.min(1, left))).toFixed(2)} ${BUFF_C}`);
  }

  get chatOpen(): boolean {
    return !this.chatInput.hidden;
  }

  /** Opens the chat line and focuses it; `onClose` is called when it closes. */
  openChat(onClose: () => void): void {
    this.chatInput.value = '';
    this.chatInput.hidden = false;
    this.chatClosed = onClose;
    this.chatInput.focus();
  }

  /** Closes the chat line, discarding its text. */
  closeChat(): void {
    if (this.chatInput.hidden) return;
    this.chatInput.hidden = true;
    this.chatInput.value = '';
    this.chatInput.blur();
    const done = this.chatClosed;
    this.chatClosed = null;
    done?.();
  }

  /** A message above the chat line, as plain text (M8 §7). */
  addChat(name: string, text: string, now: number): void {
    const line = el('div', 'chat-message', this.chatMessages);
    el('span', 'chat-name', line).textContent = `${name}: `;
    line.append(text);
    this.chatShown.push({ el: line, at: now });
    while (this.chatShown.length > CHAT_LINES) this.chatShown.shift()!.el.remove();
  }

  /** Toggles the hints panel (M8 §2.2). */
  toggleHints(): void {
    this.hints.hidden = !this.hints.hidden;
  }

  /** Closes the hints panel, as at the result. */
  closeHints(): void {
    this.hints.hidden = true;
  }

  get hintsOpen(): boolean {
    return !this.hints.hidden;
  }

  /** Displayed cooldowns in seconds and their full lengths. */
  setCooldowns(q: number, qMax: number, e: number, eMax: number): void {
    [
      [q, qMax],
      [e, eMax],
    ].forEach(([cd, max], i) => {
      const a = this.abilities[i];
      // Ready glint (M8 §2.3): when the cooldown runs out, not for an ability that was never on one.
      if (a.cd > 0 && cd <= 0) this.glint(i);
      a.cd = cd;
      // The ring covers the part of the cooldown that has passed (M9 §6.4).
      const passed = cd > 0 ? 1 - Math.min(1, cd / max) : 0;
      a.arc.setAttribute('stroke-dasharray', `${(passed * RING_C).toFixed(2)} ${RING_C}`);
      // The seconds with an `s` (M9 §6.4); Cinzel has no lowercase, so the unit is in the body font.
      const secs = cd > 0 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '';
      if (a.text.dataset.secs !== secs) {
        a.text.dataset.secs = secs;
        a.text.replaceChildren();
        if (secs) {
          a.text.append(secs);
          el('span', 'ability-cd-unit', a.text).textContent = 's';
        }
      }
      a.box.classList.toggle('ready', cd <= 0);
    });
  }

  /** A diagonal band of light sweeps across the icon while the slot frame glows gold and fades. */
  private glint(i: number): void {
    const a = this.abilities[i];
    a.glint.animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }], { duration: GLINT_SWEEP_MS, easing: 'ease-in-out' });
    a.box.animate([{ filter: 'drop-shadow(0 0 10px rgba(243, 198, 75, 1)) brightness(1.35)' }, { filter: 'drop-shadow(0 0 6px rgba(240, 138, 36, 0.9))' }], {
      duration: GLINT_GLOW_MS,
      easing: 'ease-out',
    });
    this.onReady(i === 0 ? 'Q' : 'E');
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

  /** Hit and kill markers: four short ticks on the diagonals around the crosshair (M8 §3.2). */
  private marker(className: string): HTMLDivElement {
    const m = el('div', `marker ${className}`, this.root);
    for (const a of MARKER_TICKS) el('div', 'marker-tick', m).style.transform = `rotate(${a}deg) translateY(7px)`;
    return m;
  }

  /**
   * A shot: recoil (`recoil` % of the screen height), the muzzle tipping up by `tilt` degrees (M11 §3.2;
   * `alternate` flips its sign each shot), the glow, alt frame and hammer of `intervalMs`, and a muzzle
   * flash `flashScale` times its size, or none. Each flash gets a random rotation and scale (M8 §3.3).
   */
  shot(now: number, intervalMs: number, tilt: number, alternate = false, recoil = RECOIL_PCT, flashScale = 1, flash = true): void {
    this.shotAt = now;
    this.tilt.shot(tilt, alternate);
    this.fireIntervalMs = intervalMs;
    this.recoilPct = recoil;
    this.flashOn = flash;
    this.flashRotate = Math.random() * 360;
    this.flashScale = flashScale * (0.8 + Math.random() * 0.4);
  }

  /** The Scourge: the left hand swings a chain across the view over 0.3 s (M9 §5.1). */
  swing(now: number): void {
    this.swingAt = now;
  }

  /**
   * The weapon's offsets this frame in vh (bob, sway, recoil, and moving out of the Scourge's way) and its
   * tilt in degrees (M11 §3.2, §3.6).
   */
  private pose(now: number): { dx: number; dy: number; tilt: number } {
    const since = now - this.shotAt;
    const r = recoilLeft(since, this.fireIntervalMs);
    const sw = this.weaponManifest.swing ? swingPose(now - this.swingAt, this.weaponManifest.swing.chain.frames) : null;
    return {
      dx: this.bobX + this.sway.x + (sw?.gunX ?? 0),
      dy: this.bobY + this.sway.y + r * this.recoilPct + (sw?.gunY ?? 0),
      tilt: recoilTilt(this.tilt.T, since, this.fireIntervalMs),
    };
  }

  /** The first-person muzzle point on screen in CSS pixels, transformed with the weapon (for Sacrament's beam and the flash). */
  muzzlePoint(now: number): [number, number] {
    const m = this.weaponManifest;
    const { dx, dy, tilt } = this.pose(now);
    const [x, y] = transformPoint(m.muzzle, m.pivot, tilt, dx / VH_PER_PX, dy / VH_PER_PX);
    const k = (window.innerHeight / 100) * VH_PER_PX;
    return [window.innerWidth / 2 + x * k, y * k];
  }

  /** While Sacrament's beam leaves the local player's muzzle, the censer glows green (M11 §3.9). */
  setHealing(on: boolean, now: number): void {
    this.heal.set(on, now);
  }

  /** The light at the player's position (the lightmap's L, 0–1) over the last `dt` s (M11 §3.5). */
  setLight(L: number, dt: number): void {
    if (!WEAPON_LIGHT) return;
    const b = this.light.update(dt, L);
    if (b === null) return;
    this.brightness = b;
    this.writeFilters();
  }

  /** The weapon's (and the swing's) filter: its brightness, and the Field of Blood's glow when on. */
  private writeFilters(): void {
    const f = [WEAPON_LIGHT ? `brightness(${this.brightness.toFixed(3)})` : '', this.fieldFilter].filter(Boolean).join(' ');
    this.weaponBox.style.filter = f;
    if (this.swingChain) this.swingChain.style.filter = f;
    if (this.swingFist) this.swingFist.style.filter = f;
  }

  /**
   * Standing in a Field of Blood (M9 §5.1): a blood-red glow rising at the bottom edge, pulsing slowly
   * and flaring on entering; the weapon glows blood red; the crosshair turns blood red.
   */
  setInField(on: boolean, now: number): void {
    if (on === this.inField) return;
    this.inField = on;
    if (on) this.fieldEnteredAt = now;
    this.crosshair.classList.toggle('blood', on);
    this.fieldFilter = on ? 'drop-shadow(0 0 14px rgba(200, 24, 24, 0.85))' : '';
    this.writeFilters();
  }

  /** The steady green vignette while a Sacrament beam is on the player (M9 §5.1). */
  setBeamed(on: boolean): void {
    this.beamVignette.style.opacity = on ? '0.15' : '0';
  }

  /** The weapon's bob offset in % of the screen height (M8 §3.4). */
  setBob(x: number, y: number): void {
    this.bobX = x;
    this.bobY = y;
  }

  /** The ally chevron at a screen position in pixels, or hidden for null (M8 §3.5). */
  setChevron(kind: 'gold' | 'grey' | null, x = 0, y = 0): void {
    this.chevron.hidden = kind === null;
    if (kind === null) return;
    this.chevron.classList.toggle('grey', kind === 'grey');
    this.chevron.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
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

  /**
   * The dead player's screen (M8 §4.5): a line, an optional smaller second line, and their revive
   * bar; `ember` is the joined-as-soul look (an ember vignette instead of the grey). Null hides it.
   */
  setDeath(text: string | null, sub: string | null = null, ember = false): void {
    this.death.hidden = text === null;
    this.deathMain.textContent = text ?? '';
    this.deathSub.textContent = sub ?? '';
    this.deathSub.hidden = sub === null;
    this.emberVignette.hidden = !(text !== null && ember);
  }

  /** The dead player's own revive progress, 0–1. */
  setOwnRevive(progress: number): void {
    this.deathFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  }

  /**
   * The arena countdown (M8 §5): `The doors seal in 0:47`, and the number alone, large, in the last
   * 5 s; null hides both.
   */
  setCountdown(seconds: number | null): void {
    this.countdownLine.hidden = seconds === null;
    this.countdownBig.hidden = seconds === null || seconds > 5;
    if (seconds === null) return;
    const s = Math.ceil(seconds - 1e-6);
    this.countdownLine.textContent = `The doors seal in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.countdownBig.textContent = String(Math.max(1, s));
  }

  /**
   * Soul markers (M8 §4.1): a class icon with an ember glow and the revive bar, at screen positions
   * in pixels; souls not listed are hidden.
   */
  setSoulMarkers(list: ReadonlyArray<{ id: number; classId: ClassId; x: number; y: number; progress: number }>): void {
    const seen = new Set<number>();
    for (const m of list) {
      seen.add(m.id);
      let s = this.souls.get(m.id);
      if (!s) {
        const root = el('div', 'soul-marker', this.soulLayer);
        const icon = el('img', 'soul-icon', root);
        icon.src = spriteUrl(`class-${m.classId}`);
        icon.alt = '';
        const bar = el('div', 'soul-bar', root);
        s = { root, fill: el('div', 'soul-fill', bar) };
        this.souls.set(m.id, s);
      }
      s.root.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
      s.fill.style.width = `${Math.max(0, Math.min(1, m.progress)) * 100}%`;
    }
    for (const [id, s] of this.souls) {
      if (seen.has(id)) continue;
      s.root.remove();
      this.souls.delete(id);
    }
  }

  showResult(text: string): void {
    this.setDeath(null);
    this.result.textContent = text;
    this.result.hidden = false;
  }

  /**
   * The Scourge (M11 §3.6): the chain's frame of the moment and the fist where its hand is, turned along
   * its forearm, with the weapon's bob, sway and light, fading out at the end.
   */
  private updateSwing(now: number): void {
    const sw = this.weaponManifest.swing;
    if (!sw || !this.swingChain || !this.swingFist) return;
    const pose = swingPose(now - this.swingAt, sw.chain.frames);
    const f = pose ? pose.frame : -1;
    if (f !== this.swingFrame) {
      this.swingFrame = f;
      this.swingChain.hidden = f < 0;
      this.swingFist.hidden = f < 0;
      if (f >= 0) {
        const at = `translateY(${((-f / sw.chain.frames) * 100).toFixed(4)}%)`;
        for (const l of this.swingLayers) l.style.transform = at;
        const [hx, hy] = sw.hands[f];
        this.swingFist.style.left = `calc(50% + ${vh(hx - sw.fist.center[0])})`;
        this.swingFist.style.top = vh(hy - sw.fist.center[1]);
      }
    }
    if (!pose) return;
    const offset = `translate(${(this.bobX + this.sway.x).toFixed(3)}vh, ${(this.bobY + this.sway.y).toFixed(3)}vh)`;
    this.swingChain.style.transform = offset;
    this.swingFist.style.transform = `${offset} rotate(${(sw.hands[f][2] - sw.fist.angle).toFixed(2)}deg)`;
    const op = pose.opacity >= 1 ? '1' : pose.opacity.toFixed(3);
    this.put(this.swingChain, 'swing-chain', 'opacity', op);
    this.put(this.swingFist, 'swing-fist', 'opacity', op);
  }

  /** Sets a style property unless it already has that value. */
  private put(e: HTMLElement, key: string, prop: 'opacity' | 'transform' | 'visibility', value: string): void {
    if (this.written.get(key) === value) return;
    this.written.set(key, value);
    e.style[prop] = value;
  }

  /** The painted weapon this frame (M11 §3): its transform, the alt frame, hammer, cylinder, censer and glow. */
  private updateWeapon(now: number): void {
    const m = this.weaponManifest;
    const L = this.layers;
    const { dx, dy, tilt } = this.pose(now);
    this.weaponBox.style.transform = `translate(${dx.toFixed(3)}vh, ${dy.toFixed(3)}vh) rotate(${tilt.toFixed(3)}deg)`;
    const since = now - this.shotAt;
    const a = m.alt ? altLevel(m.alt.kind, since, this.fireIntervalMs) : 0;
    const h = m.heal ? this.heal.value(now) : 0;
    const o = layerOpacities(glowLevel(now, since), a, h);
    const op = (n: number) => (n <= 0 ? '0' : n >= 1 ? '1' : n.toFixed(3));
    if (L.idle) this.put(L.idle, 'idle', 'visibility', a >= 1 ? 'hidden' : 'visible');
    if (L.alt) this.put(L.alt, 'alt', 'opacity', op(a));
    if (L['idle-glow']) this.put(L['idle-glow'], 'idle-glow', 'opacity', op(o.idleGlow));
    if (L['alt-glow']) this.put(L['alt-glow'], 'alt-glow', 'opacity', op(o.altGlow));
    if (L['censer-green']) this.put(L['censer-green'], 'censer', 'opacity', op(o.censer));
    if (L['censer-green-glow']) this.put(L['censer-green-glow'], 'censer-glow', 'opacity', op(o.censerGlow));
    if (L.hammer && m.hammer) this.put(L.hammer, 'hammer', 'transform', `rotate(${hammerAngle(m.hammer.fall, since, this.fireIntervalMs).toFixed(2)}deg)`);
    if (L.cylinder) this.put(L.cylinder, 'cylinder', 'opacity', op(cylinderBlur(since, this.fireIntervalMs)));
  }

  update(now: number): void {
    this.updateWeapon(now);
    this.updateSwing(now);
    // The field's glow: 0.25–0.35 over 1.2 s, flaring to 0.5 for 0.3 s on entering.
    if (this.inField) {
      const pulse = 0.3 + 0.05 * Math.sin((now / FIELD_PULSE_MS) * Math.PI * 2);
      this.fieldGlow.style.opacity = (now - this.fieldEnteredAt < FIELD_FLARE_MS ? 0.5 : pulse).toFixed(3);
    } else this.fieldGlow.style.opacity = '0';
    const flashing = this.flashOn && now - this.shotAt < FLASH_MS;
    this.put(this.flash, 'flash', 'opacity', flashing ? '0.9' : '0');
    if (flashing) {
      const [fx, fy] = this.muzzlePoint(now);
      this.flash.style.transform = `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px) rotate(${this.flashRotate.toFixed(1)}deg) scale(${this.flashScale.toFixed(3)})`;
    }
    // The kill marker replaces the hit marker while shown.
    const killing = now - this.killAt < KILL_MARKER_MS;
    this.hitMarker.style.opacity = !killing && now - this.hitAt < HIT_MARKER_MS ? '1' : '0';
    this.killMarker.style.opacity = killing ? '1' : '0';
    const shaking = now - this.shakeAt < SHAKE_MS;
    this.hpBar.style.transform = shaking ? `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 6}px)` : '';
    if (now > this.centerUntil) this.center.hidden = true;
    while (this.chatShown.length && now - this.chatShown[0].at >= CHAT_SHOW_MS) this.chatShown.shift()!.el.remove();
    for (const m of this.chatShown) m.el.style.opacity = String(Math.min(1, (CHAT_SHOW_MS - (now - m.at)) / CHAT_FADE_MS));
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
