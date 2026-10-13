// Crisp text and pixels (G5): the CRT overlay's scanlines fall on whole device pixels at 100%, 125%, 150% and 200%
// display scaling (src/ui/crt.ts); the goal card, the most read text in a city, is not drawn rotated at rest (a
// rotation resamples its text and the portrait's pixels: measured 12-14% less sharp at every scale).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanlineSizes } from '../src/ui/crt';

describe('CRT scanlines', () => {
  it('one dark line every three, each a whole number of device pixels', () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.5, 3]) {
      const { line, step } = scanlineSizes(dpr);
      expect(Math.abs(line * dpr - Math.round(line * dpr))).toBeLessThan(1e-9);
      expect(step / line).toBeCloseTo(3, 9);
      expect(line * dpr).toBeGreaterThanOrEqual(1);
    }
    expect(scanlineSizes(1)).toEqual({ line: 1, step: 3 });
    expect(scanlineSizes(2)).toEqual({ line: 1, step: 3 });
    expect(scanlineSizes(1.25).line).toBeCloseTo(0.8, 9);
  });

  it('the overlay reads them, with the old 1 px / 3 px when they are not set', () => {
    const css = readFileSync('src/style.css', 'utf8');
    const crt = css.slice(css.indexOf('.crt {'), css.indexOf('}', css.indexOf('.crt {')));
    expect(crt).toContain('var(--crt-line, 1px)');
    expect(crt).toContain('var(--crt-step, 3px)');
  });
});

describe('goal card', () => {
  it('has no transform at rest', () => {
    const css = readFileSync('src/style.css', 'utf8');
    const rule = css.slice(css.indexOf('\n.objective {'), css.indexOf('}', css.indexOf('\n.objective {')));
    expect(rule).not.toMatch(/transform/);
  });
});
