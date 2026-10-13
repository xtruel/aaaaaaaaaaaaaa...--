// @vitest-environment jsdom
// Toolbar names that fit their card (src/ui/fit.ts): a one-word name wider than its card (es/pt "Incineradora",
// pl "Naprawialnia" on the 72 px cards below 1280 px) is set tighter and a little smaller on that card only; names
// that fit keep the style sheet's size; words are never cut or changed. jsdom has no layout: text widths are
// stubbed as 0.5 em per letter plus the letter spacing, the card's inner width is set by hand.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIT_MIN_PX, fitFontSize, fitToolNames, nameWords } from '../src/ui/fit';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('fitFontSize', () => {
  it('keeps the size of a word that fits', () => {
    expect(fitFontSize(60, 62, 12)).toBe(12);
    expect(fitFontSize(62, 62, 12)).toBe(12);
  });
  it('shrinks in half pixels to the largest size that fits, never below the minimum', () => {
    expect(fitFontSize(67.4, 62, 12)).toBe(11); // 12 * 62 / 67.4 = 11.04
    expect(fitFontSize(69.4, 62, 12)).toBe(10.5); // 10.72
    expect(fitFontSize(64.3, 62, 12)).toBe(11.5); // 11.57
    expect(fitFontSize(200, 62, 12)).toBe(FIT_MIN_PX);
    for (const w of [63, 66.6, 70, 74.2]) {
      const f = fitFontSize(w, 62, 12);
      expect((w * f) / 12).toBeLessThanOrEqual(62);
      expect(f * 2).toBe(Math.round(f * 2));
    }
  });
});

describe('nameWords', () => {
  it('breaks where the browser may wrap: spaces and after a hyphen', () => {
    expect(nameWords('Incineradora')).toEqual(['Incineradora']);
    expect(nameWords(' Spalarnia  złomu ')).toEqual(['Spalarnia', 'złomu']);
    expect(nameWords('Lab Arranja-Tudo')).toEqual(['Lab', 'Arranja-', 'Tudo']);
  });
});

describe('fitToolNames', () => {
  const setup = (names: string[], inner = 66) => {
    const style = document.createElement('style');
    style.textContent = '.tool { padding-left: 2px; padding-right: 2px; } .tool-name { font-size: 12px; letter-spacing: 0.24px; }';
    document.head.append(style);
    const bar = document.createElement('nav');
    for (const n of names) bar.insertAdjacentHTML('beforeend', `<button class="tool"><span class="tool-plate"></span><span class="tool-name">${n}</span></button>`);
    document.body.append(bar);
    for (const b of bar.querySelectorAll<HTMLElement>('.tool')) Object.defineProperty(b, 'clientWidth', { configurable: true, get: () => inner });
    // 0.5 em a letter, plus the letter spacing after each letter
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const cs = getComputedStyle(this);
      const fs = parseFloat(cs.fontSize) || 12;
      const ls = parseFloat(cs.letterSpacing) || 0;
      const n = (this.textContent ?? '').length;
      const width = n * (fs / 2 + ls);
      return { width, height: fs, left: 0, top: 0, right: width, bottom: fs, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    return bar;
  };
  const sizes = (bar: HTMLElement) => [...bar.querySelectorAll<HTMLElement>('.tool-name')].map((n) => [n.textContent, n.style.fontSize, n.style.letterSpacing]);

  it('leaves names that fit alone and fits only the long word, without changing it', () => {
    // room 66 - 4 = 62: "Naprawialnia" 12 letters = 72 + 2.9 wide, "Huta" 24 + 1
    const bar = setup(['Huta', 'Naprawialnia', 'Spalarnia złomu']);
    fitToolNames(bar);
    const [huta, napr, spal] = sizes(bar);
    expect(huta).toEqual(['Huta', '', '']);
    expect(spal).toEqual(['Spalarnia złomu', '', '']);
    expect(napr[0]).toBe('Naprawialnia');
    expect(napr[2]).toBe('0px');
    expect(parseFloat(napr[1]!)).toBe(10); // 12 * 62 / 72 = 10.33 -> 10
  });

  it('gives the same result however often it runs, and lets go when the card is wide again', () => {
    const bar = setup(['Incineradora']);
    fitToolNames(bar);
    const once = sizes(bar);
    fitToolNames(bar);
    expect(sizes(bar)).toEqual(once);
    expect(once[0]![1]).not.toBe('');
    for (const b of bar.querySelectorAll<HTMLElement>('.tool')) Object.defineProperty(b, 'clientWidth', { configurable: true, get: () => 92 });
    fitToolNames(bar);
    expect(sizes(bar)).toEqual([['Incineradora', '', '']]);
  });

  it('letter spacing alone is enough when it is (no smaller font)', () => {
    // "Oczyszczacz" 11 letters: 66 + 2.6 with spacing, 66 without; room 66 - 4 = 62 -> needs both; room 70 - 4 = 66 -> spacing only
    const bar = setup(['Oczyszczacz'], 70);
    fitToolNames(bar);
    expect(sizes(bar)).toEqual([['Oczyszczacz', '', '0px']]);
  });
});
