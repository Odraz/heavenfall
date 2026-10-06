/**
 * The mouse glyph (M9 §6.1): a mouse outline drawn in code, 12 × 16 px at its base size, with the left
 * or right button half filled ember. Shown before the attacks on the class cards and in the hints panel.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const EMBER = '#ff7a3a';

export function mouseGlyph(button: 'left' | 'right', width = 12, height = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 16');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('class', 'mouse-glyph');
  svg.setAttribute('aria-hidden', 'true');
  const path = (d: string, attrs: Record<string, string>): void => {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    svg.appendChild(p);
  };
  // The pressed button: the top quarter of the body on its side, down to the button line.
  path(button === 'left' ? 'M6 0.75 A5.25 5.25 0 0 0 0.75 6 V7 H6 Z' : 'M6 0.75 A5.25 5.25 0 0 1 11.25 6 V7 H6 Z', { fill: EMBER });
  const line = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.2', 'stroke-linejoin': 'round' };
  // The body, and the lines between the buttons and under them.
  path('M6 0.75 A5.25 5.25 0 0 1 11.25 6 V10 A5.25 5.25 0 0 1 0.75 10 V6 A5.25 5.25 0 0 1 6 0.75 Z', line);
  path('M6 0.75 V7 M0.75 7 H11.25', line);
  return svg;
}
