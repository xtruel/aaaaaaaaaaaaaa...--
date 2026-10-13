// The result table the runner prints and writes to summary.txt: one row per test, with the input it used.
// rows: [{ test, input, build, checks, time, result, why }]
export function table(rows, cols = ['test', 'input', 'build', 'checks', 'time', 'result']) {
  const width = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length))]));
  const line = (r) => cols.map((c) => String(r[c] ?? '').padEnd(width[c])).join(' | ').trimEnd();
  return [line(Object.fromEntries(cols.map((c) => [c, c]))), cols.map((c) => '-'.repeat(width[c])).join('-|-'), ...rows.map(line)].join('\n');
}

// One row from a test's first run and, when it failed under load, its run alone.
export function row(test, inputLabel, first, alone) {
  const final = alone ?? first;
  const result = final.ok ? (alone ? 'FLAKY (failed under load, passed alone)' : 'PASS') : alone ? 'FAIL (also alone)' : 'FAIL';
  const why = final.ok ? '' : (final.crashed ?? (final.failed?.length ? `${final.failed.slice(0, 3).join(' | ')}${final.failed.length > 3 ? ` (+${final.failed.length - 3} more)` : ''}` : ''));
  return {
    test: test.name,
    input: inputLabel,
    build: test.build,
    checks: `${final.pass}/${final.pass + final.fail}`,
    time: `${(first.ms / 1000).toFixed(0)} s${alone ? ` / ${(alone.ms / 1000).toFixed(0)} s alone` : ''}`,
    result,
    why,
  };
}
