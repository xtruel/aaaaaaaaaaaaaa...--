// The smog alarm (the 95% countdown) and the catalog on a short window (1280x720, 1024x640), which jsdom cannot lay out.
// There the catalog is 400 px wide (G4) and stands at the alarm's height; measured in a browser, without its own rule
// the centred alarm went under the panel and lost the end of its words (the seconds left at 1024x640). The alarm then
// keeps to the room between the goal card (350 px from the left, as its usual max-width allows) and the panel. This
// guards that geometry: whatever the window's width, the alarm's widest box (also at the top of its 4% pulse) ends
// left of the panel and starts right of the goal card.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const shortWindow = css.slice(css.indexOf('@media (max-height: 760px) {\n  .catalog {'));

describe('smog alarm beside the catalog on a short window', () => {
  it('the alarm keeps clear of the 400 px catalog and of the goal card', () => {
    const panel = /\.catalog \{\s*width: (\d+)px;\s*\}/.exec(shortWindow);
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
});
