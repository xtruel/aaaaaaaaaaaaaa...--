// The smog alarm (the 95% countdown) and the catalog on a short window (1280x720, 1024x640), which jsdom cannot lay out.
// There the catalog is 400 px wide (G4) and stands at the alarm's height; measured in a browser, without its own rule
// the centred alarm went under the panel and lost the end of its words (the seconds left at 1024x640). The alarm then
// keeps to the room between the goal card (350 px from the left, as its usual max-width allows) and the panel. This
// guards that geometry: whatever the window's width, the alarm's widest box (also at the top of its 4% pulse) ends
// left of the panel and starts right of the goal card.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const shortWindow = css.slice(css.indexOf('@media (max-height: 760px) {\n  .hud {'));

describe('smog alarm beside the catalog on a short window', () => {
  it('the alarm keeps clear of the 400 px catalog and of the goal card', () => {
    // (G5: the catalog's width is the HUD's --cat-w, which the smog panel reads too)
    const panel = /\.hud \{\s*--cat-w: (\d+)px;\s*\}/.exec(shortWindow);
    const alarm = /\.hud:has\(\.catalog:not\(\[hidden\]\)\) \.smog-alert \{\s*left: calc\(50% - (\d+)px\);\s*max-width: max\((\d+)px, calc\(100% - (\d+)px\)\);\s*\}/.exec(shortWindow);
    expect(panel, 'the short-window catalog width').not.toBeNull();
    expect(alarm, 'the alarm rule while the catalog is open').not.toBeNull();
    const width = Number(panel![1]);
    const [shift, least, reserve] = alarm!.slice(1).map(Number);
    for (const w of [1024, 1152, 1280, 1366]) {
      const centre = w / 2 - shift;
      const half = Math.max(least, w - reserve) / 2;
      const panelLeft = w - 10 - width; // the side panels stand 10 px from the right edge
      expect(centre + half * 1.04, `${w}: right edge at the top of the pulse`).toBeLessThanOrEqual(panelLeft);
      expect(centre - half, `${w}: left edge`).toBeGreaterThanOrEqual(350);
    }
  });

  // G5: the smog panel open with the catalog keeps to the room between the goal card and the catalog (it went under
  // the catalog on 1024 px wide windows); centred where there is room
  it('the smog panel keeps clear of the catalog and of the goal card on windows 1024 px and wider', () => {
    const base = /\.hud \{[^}]*--cat-w: (\d+)px;/.exec(css);
    const rule = /\.hud:has\(\.catalog:not\(\[hidden\]\)\) \.smog-panel \{\s*--smog-w: clamp\((\d+)px, calc\(100% - (\d+)px - var\(--cat-w\)\), (\d+)px\);\s*width: var\(--smog-w\);\s*left: clamp\(calc\((\d+)px \+ var\(--smog-w\) \/ 2\), 50%, calc\(100% - (\d+)px - var\(--cat-w\) - var\(--smog-w\) \/ 2\)\);\s*\}/.exec(css);
    expect(base, 'the catalog width').not.toBeNull();
    expect(rule, 'the smog panel rule while the catalog is open').not.toBeNull();
    const [least, reserve, most, edge, gap] = rule!.slice(1).map(Number);
    expect(css.includes('width: var(--cat-w);')).toBe(true);
    for (const cat of [Number(base![1]), 400])
      for (const w of [1024, 1152, 1280, 1366, 1920]) {
        const width = Math.min(most, Math.max(least, w - reserve - cat));
        const centre = Math.min(Math.max(edge + width / 2, w / 2), w - gap - cat - width / 2);
        const catalogLeft = w - 10 - cat;
        expect(centre + width / 2, `${w}, catalog ${cat}: right edge`).toBeLessThanOrEqual(catalogLeft - 10);
        expect(centre - width / 2, `${w}, catalog ${cat}: left edge`).toBeGreaterThanOrEqual(340);
        if (w >= 1280) expect(centre, `${w}: centred where there is room`).toBe(w / 2);
      }
  });
});
