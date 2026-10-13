// Toolbar names that fit their card. Below 1280 px the build cards are 72 px wide, and a few names are one long word
// in some languages ("Incineradora", "Naprawialnia"): such a word does not wrap and ran over the card's border.
// Only on that card, the name is set without letter spacing and, if still needed, a little smaller (in half pixels,
// never below FIT_MIN_PX): the words and their meaning stay the same, nothing is cut or broken inside a word, and
// every other card keeps its size.

export const FIT_MIN_PX = 10;

// The font size (px) at which a word `widest` px wide at `base` px fits in `room` px (a text's width grows with its
// font size), in half-pixel steps; `base` when it already fits; never below `min`.
export function fitFontSize(widest: number, room: number, base: number, min = FIT_MIN_PX): number {
  if (widest <= room || widest <= 0) return base;
  return Math.max(min, Math.min(base, Math.floor(((base * room) / widest) * 2) / 2));
}

// The pieces a name can break into: at spaces, and after a hyphen ("Arranja-|Tudo").
export function nameWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .flatMap((w) => w.split(/(?<=-)/))
    .filter(Boolean);
}

// The widest word of `el`'s text in its own font, letter spacing and case (px), measured in a hidden probe so the
// name itself is not disturbed.
function widestWord(el: HTMLElement, letterSpacing?: string): number {
  const cs = getComputedStyle(el);
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre';
  probe.style.fontFamily = cs.fontFamily;
  probe.style.fontSize = cs.fontSize;
  probe.style.fontWeight = cs.fontWeight;
  probe.style.fontStyle = cs.fontStyle;
  probe.style.textTransform = cs.textTransform;
  probe.style.letterSpacing = letterSpacing ?? cs.letterSpacing;
  document.body.append(probe);
  let widest = 0;
  for (const w of nameWords(el.textContent ?? '')) {
    probe.textContent = w;
    widest = Math.max(widest, probe.getBoundingClientRect().width);
  }
  probe.remove();
  return widest;
}

// The width a card gives its name: its content box, less the picture and the gap beside it on the half-height
// Tools cards (picture beside the name).
function nameRoom(card: HTMLElement, name: HTMLElement): number {
  const cs = getComputedStyle(card);
  let room = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (cs.flexDirection === 'row') {
    const gap = parseFloat(cs.columnGap) || 0;
    for (const c of card.children) {
      if (c.contains(name) || !(c instanceof HTMLElement) || getComputedStyle(c).position === 'absolute' || c.hidden) continue;
      room -= c.getBoundingClientRect().width + gap;
    }
  }
  return room;
}

// Fits every toolbar name in `bar` to its card at the current window size (called again when the bar changes size:
// the cards are narrower below 1280 px). Starts from the style sheet's size each time, so it gives the same result
// however often it runs.
export function fitToolNames(bar: HTMLElement): void {
  for (const name of bar.querySelectorAll<HTMLElement>('.tool-name')) {
    const card = name.closest<HTMLElement>('.tool');
    if (!card) continue;
    name.style.removeProperty('font-size');
    name.style.removeProperty('letter-spacing');
    const room = nameRoom(card, name);
    if (room <= 0 || widestWord(name) <= room) continue;
    const base = parseFloat(getComputedStyle(name).fontSize);
    name.style.letterSpacing = '0px';
    const tight = widestWord(name, '0px');
    if (tight <= room) continue;
    name.style.fontSize = `${fitFontSize(tight, room, base)}px`;
  }
}
