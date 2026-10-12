// The building panel's layout on a 280 px panel (1280x800 and 1024x640), which jsdom cannot lay out: measured in a
// browser (Nunito bold 14 px), the label column of a building's numbers is 138.5 px with a 6 px gap between the
// columns (130.5 px with 10 px), "Sludge radius (tiles)" and "Sludge tile every (s)" take 131 px ("One sludge tile
// every (s)" took 159 px and wrapped), and a module card's "Remove (+25 credits + 15 parts)" keeps one line at 14 px
// with 8 px of padding. These guard the pieces of that: the English labels and the two style rules.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { setLang, t } from '../src/i18n';

describe('building panel layout (English on one line)', () => {
  it('the Purifier\'s two sludge rows have their short English labels', () => {
    setLang('en');
    expect(t('insp.radius')).toBe('Sludge radius (tiles)');
    expect(t('insp.cleanEvery')).toBe('Sludge tile every (s)');
    // no longer than the longest label measured to fit (131 px of 138.5)
    for (const k of ['insp.radius', 'insp.cleanEvery'] as const) expect(t(k).length, k).toBeLessThanOrEqual('Sludge radius (tiles)'.length);
  });

  it('the numbers sit 6 px apart, and a module card\'s buttons are 14 px with 8 px of padding', () => {
    const css = readFileSync('src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.inspector \.insp-rows \{\s*column-gap: 6px;\s*\}/);
    expect(css).toMatch(/\.insp-mod \.insp-actions \.btn \{\s*font-size: 14px;\s*padding-inline: 8px;\s*\}/);
  });
});
