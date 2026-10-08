/**
 * The Loading screen (§3): a loading card (docs/lore.md) filling the screen, with the hint tip
 * (M9 §6.2) and the progress text under it.
 */
import { el } from './menus';
import verdictUrl from '../../assets/ui/load-verdict.jpg';
import appealUrl from '../../assets/ui/load-appeal.jpg';
import fallenUrl from '../../assets/ui/load-fallen.jpg';
import hereticUrl from '../../assets/ui/load-heretic.jpg';
import binderUrl from '../../assets/ui/load-binder.jpg';
import betrayerUrl from '../../assets/ui/load-betrayer.jpg';

export interface LoadingCard {
  title: string;
  text: string;
  image: string;
}

/** The pitch, then the heroes' origins (docs/lore.md, *Loading cards*). */
export const LOADING_CARDS: readonly LoadingCard[] = [
  {
    title: 'The Verdict',
    text: 'Heaven hath weighed mankind and found it wanting. Seven trumpets are made ready, and at their sounding the world shall be unmade.',
    image: verdictUrl,
  },
  {
    title: 'The Appeal',
    text: 'Hell doth appeal the judgment. Four of the damned climb the stair of Heaven, to break the trumpets ere they sound.',
    image: appealUrl,
  },
  {
    title: 'The Fallen',
    text: 'An angel of the Host, bidden to burn a city, who would not. For that mercy was it cast down from Heaven.',
    image: fallenUrl,
  },
  {
    title: 'The Heretic Saint',
    text: 'In life a healer of the sick, by arts the Church named witchcraft. For those arts was the healer burned, and sent down into Hell.',
    image: hereticUrl,
  },
  {
    title: 'The Binder',
    text: 'An angel set to keep the chains of Hell, who for ten thousand years bound the worst of the damned, lest they reach the Earth.',
    image: binderUrl,
  },
  {
    title: 'The Betrayer',
    text: 'Sent by Heaven to spy among the damned, who dwelt with them a thousand years, and came to love them more than Heaven.',
    image: betrayerUrl,
  },
];

/** The last card shown, so the next Loading starts with another one. */
const LAST_CARD_KEY = 'heavenfall.lastCard';
/** Seconds each card stays while loading goes on. */
const CARD_SECONDS = 5;
/** The crossfade between two cards, in ms (matches `.loading-art` and `.loading-card` in style.css). */
const FADE_MS = 600;
/** The longest Loading waits for the first card's image before it starts building the game. */
const FIRST_CARD_WAIT_MS = 1500;
/** The longest it then waits for the card to be drawn. */
const FIRST_FRAMES_WAIT_MS = 100;

/** A random card index other than `not` (any card when `not` isn't a valid index). */
export function pickCard(not: number | null, random: () => number = Math.random): number {
  const n = LOADING_CARDS.length;
  if (not === null || !(not >= 0 && not < n)) return Math.floor(random() * n);
  return (not + 1 + Math.floor(random() * (n - 1))) % n;
}

function loadLastCard(): number | null {
  try {
    const v = localStorage.getItem(LAST_CARD_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function saveLastCard(index: number): void {
  try {
    localStorage.setItem(LAST_CARD_KEY, String(index));
  } catch {
    // Storage may be unavailable; the next Loading may then repeat the card.
  }
}

/** Resolves once the image is decoded (or failed), so showing it doesn't flash an empty frame. */
function decoded(img: HTMLImageElement): Promise<void> {
  return img.decode().catch(() => undefined);
}

/**
 * The Loading screen. `ready` resolves once the first card is drawn (or after
 * FIRST_CARD_WAIT_MS): building the game blocks the page for seconds, so the caller awaits it
 * first, or the screen would stay blank meanwhile.
 */
export function loadingScreen(): { el: HTMLElement; set: (text: string) => void; ready: Promise<void> } {
  const screen = el('div', 'screen loading');
  // Two image layers: the new card fades in over the old one.
  const layers = [el('img', 'loading-art', screen), el('img', 'loading-art', screen)];
  for (const img of layers) img.alt = '';
  el('div', 'loading-shade', screen);
  const card = el('div', 'loading-card', screen);
  const title = el('h2', 'loading-title', card);
  const text = el('p', 'loading-lore', card);
  const footer = el('div', 'loading-footer', screen);
  el('div', 'loading-tip', footer, "Press H in game for your class's hints.");
  const progress = el('div', 'loading-text', footer);

  let current = pickCard(loadLastCard());
  let front = 0;
  const show = (index: number): void => {
    const c = LOADING_CARDS[index]!;
    title.textContent = c.title;
    text.textContent = c.text;
    saveLastCard(index);
  };

  const first = layers[0]!;
  first.src = LOADING_CARDS[current]!.image;
  first.classList.add('shown');
  show(current);
  const ready = Promise.race([decoded(first), new Promise<void>((r) => setTimeout(r, FIRST_CARD_WAIT_MS))]).then(
    // Two frames, so the decoded card is on screen before the page blocks. A hidden page draws no
    // frames, so it waits at most FIRST_FRAMES_WAIT_MS: Loading must never stall in the background.
    () =>
      new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
        setTimeout(r, FIRST_FRAMES_WAIT_MS);
      }),
  );

  // The next card is decoded in the back layer ahead of its turn; a turn that comes before it's
  // ready is skipped.
  let next = pickCard(current);
  let nextReady = false;
  const prepareNext = (): void => {
    const back = layers[1 - front]!;
    nextReady = false;
    back.src = LOADING_CARDS[next]!.image;
    void decoded(back).then(() => (nextReady = true));
  };
  prepareNext();

  const timer = setInterval(() => {
    if (!screen.isConnected) {
      clearInterval(timer);
      return;
    }
    if (!nextReady) return;
    layers[1 - front]!.classList.add('shown');
    layers[front]!.classList.remove('shown');
    front = 1 - front;
    current = next;
    card.classList.add('fading');
    setTimeout(() => {
      show(current);
      card.classList.remove('fading');
      next = pickCard(current);
      prepareNext();
    }, FADE_MS);
  }, CARD_SECONDS * 1000);

  return { el: screen, set: (t) => (progress.textContent = t), ready };
}
