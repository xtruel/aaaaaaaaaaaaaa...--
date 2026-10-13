// The CRT overlay (setting "CRT effect"): its scanlines on whole device pixels. In CSS pixels (1 px dark every 3 px)
// they fall between device pixels at 125% or 150% display scaling and band unevenly over small text; rounded to
// device pixels they stay one dark line every three, as at 100%.

// The line and the period of the scanlines in CSS px for a devicePixelRatio: a whole number of device pixels each.
export function scanlineSizes(dpr: number): { line: number; step: number } {
  const d = dpr > 0 ? dpr : 1;
  const line = Math.max(1, Math.round(d)) / d;
  return { line, step: 3 * line };
}

export function alignScanlines(): void {
  const { line, step } = scanlineSizes(window.devicePixelRatio || 1);
  document.documentElement.style.setProperty('--crt-line', `${line}px`);
  document.documentElement.style.setProperty('--crt-step', `${step}px`);
}
