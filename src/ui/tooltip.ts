/**
 * Tooltips on the class cards (M8 §2.1): a panel above the hovered item with its name and
 * description, shown after 150 ms and hidden when the pointer leaves.
 */

const DELAY_MS = 150;
const GAP_PX = 8;

let tip: HTMLDivElement | null = null;
let timer = 0;

function element(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    tip.setAttribute('role', 'tooltip');
  }
  if (!tip.isConnected) document.body.appendChild(tip);
  return tip;
}

function hide(): void {
  clearTimeout(timer);
  if (tip) tip.hidden = true;
}

/** Shows `name` and `description` above `target` while the pointer is over it. */
export function attachTooltip(target: HTMLElement, name: string, description: string): void {
  target.addEventListener('pointerenter', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!target.isConnected) return;
      const t = element();
      t.replaceChildren();
      const title = document.createElement('div');
      title.className = 'tooltip-name';
      title.textContent = name;
      const text = document.createElement('div');
      text.className = 'tooltip-text';
      text.textContent = description;
      t.append(title, text);
      t.hidden = false;
      // Centered above the item, kept on screen.
      const r = target.getBoundingClientRect();
      const w = t.offsetWidth;
      const left = Math.max(4, Math.min(window.innerWidth - w - 4, r.left + r.width / 2 - w / 2));
      t.style.left = `${left}px`;
      t.style.top = `${Math.max(4, r.top - t.offsetHeight - GAP_PX)}px`;
    }, DELAY_MS);
  });
  target.addEventListener('pointerleave', hide);
}

/** Hides any open tooltip: a screen change removes its target without a pointerleave. */
export function hideTooltip(): void {
  hide();
}
