#!/usr/bin/env node
// The end-to-end suite: builds the debug and release builds of this checkout, runs the tests (each in its own Node
// process and browser), prints a table with the input of every row, exits 1 when a test fails.
//   npm run e2e                         everything
//   npm run e2e -- items-pad saves      only these tests (a name, or a prefix ending in *: items-*)
//   npm run e2e -- --list               the tests and what they cover
// Options: --jobs N (tests at once, default 2), --no-rerun (a failed test is not run again alone), --rebuild,
//          --out DIR. E2E_DEBUG_DIR / E2E_RELEASE_DIR test builds made elsewhere.
// A test that fails while others run is run again ALONE: on a loaded machine (other browsers, 4 cores) a timing
// failure must be seen twice before it is called real. Both results are in the table.
import { spawn } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, createWriteStream } from 'fs';
import { join } from 'path';
import { cpus, loadavg } from 'os';
import { ensureBuilds, ROOT } from './lib/build.mjs';
import { INPUT_LABEL } from './lib/input.mjs';
import { row, table } from './lib/table.mjs';
import { TESTS } from './tests.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const jobs = Math.max(1, Number(opt('--jobs', process.env.E2E_JOBS ?? 2)));
const outArg = opt('--out', null);
const list = flag('--list');
const noRerun = flag('--no-rerun');
const rebuild = flag('--rebuild');
const names = args.filter((a) => !a.startsWith('--'));

const match = (t) => !names.length || names.some((n) => (n.endsWith('*') ? t.name.startsWith(n.slice(0, -1)) : t.name === n));
const selected = TESTS.filter(match);

if (list) {
  for (const t of TESTS) console.log(`${t.name.padEnd(20)} ${(t.input ? INPUT_LABEL[t.input] : t.inputLabel).padEnd(40)} ${t.build.padEnd(8)} ~${t.minutes} min  ${t.what}`);
  process.exit(0);
}
if (!selected.length) {
  console.error(`no test matches ${names.join(' ')}; npm run e2e -- --list`);
  process.exit(2);
}

const b = ensureBuilds({ rebuild });
console.log(`builds of ${b.key}${b.dirty ? ' (checkout with changes)' : ''}: debug ${b.debugSha.slice(0, 12)} (hook present), release ${b.releaseSha.slice(0, 12)} (no hook)${b.built.length ? `, built now: ${b.built.join(', ')}` : ', from the cache'}`);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const runDir = outArg ?? join(b.dir, 'runs', stamp);
mkdirSync(runDir, { recursive: true });
console.log(`output: ${runDir}`);
console.log(`${selected.length} test(s), ${jobs} at a time, ${cpus().length} cores, load ${loadavg()[0].toFixed(2)}\n`);

function runOne(t, attempt) {
  const out = join(runDir, attempt === 1 ? t.name : `${t.name}.alone`);
  mkdirSync(out, { recursive: true });
  const cfg = { ...t.cfg, name: t.name, input: t.input ?? null, inputLabel: t.inputLabel ?? null, build: t.build, debug: b.debug, release: b.release, out };
  const t0 = Date.now();
  const load0 = loadavg()[0];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(ROOT, 'e2e', 'tests', t.file), JSON.stringify(cfg)], { cwd: ROOT, env: { ...process.env } });
    const log = createWriteStream(join(out, 'log.txt'));
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    const limit = setTimeout(() => child.kill('SIGKILL'), t.minutes * 4 * 60 * 1000 + 120000);
    child.on('close', (code, signal) => {
      clearTimeout(limit);
      let r = null;
      try {
        r = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
      } catch {
        r = null;
      }
      const ms = Date.now() - t0;
      const ok = code === 0 && r && r.fail === 0 && !r.crashed;
      const res = { name: t.name, attempt, ok, code, signal, ms, load: Math.max(load0, loadavg()[0]), pass: r?.pass ?? 0, fail: r?.fail ?? (ok ? 0 : 1), crashed: r?.crashed ?? (r ? null : `no result (exit ${code}${signal ? `, ${signal}` : ''})`), first: r?.checks?.find((c) => !c.ok)?.name ?? null, failed: (r?.checks ?? []).filter((c) => !c.ok).map((c) => c.name), out };
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name.padEnd(20)} ${String(res.pass).padStart(4)} ok ${String(res.fail).padStart(3)} failed  ${(ms / 1000).toFixed(0).padStart(4)} s${attempt > 1 ? '  (alone)' : ''}${ok ? '' : `  -> ${res.crashed ?? res.first}`}`);
      resolve(res);
    });
  });
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      results[k] = await fn(items[k]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

const t0 = Date.now();
// the longest first, so the pool ends together
const order = [...selected].sort((a, c) => c.minutes - a.minutes);
const first = await pool(order, jobs, (t) => runOne(t, 1));
const byName = Object.fromEntries(first.map((r) => [r.name, { first: r, alone: null }]));
const failed = first.filter((r) => !r.ok);
if (failed.length && !noRerun && (jobs > 1 || selected.length > 1)) {
  console.log(`\n${failed.length} failed: run again alone, one at a time`);
  for (const r of failed) byName[r.name].alone = await runOne(TESTS.find((t) => t.name === r.name), 2);
}
const wall = Date.now() - t0;

// ---------- the table ----------
const rows = selected.map((t) => row(t, t.input ? INPUT_LABEL[t.input] : t.inputLabel, byName[t.name].first, byName[t.name].alone));
const tableText = table(rows);
const fails = rows.filter((r) => r.result.startsWith('FAIL'));
const flaky = rows.filter((r) => r.result.startsWith('FLAKY'));
const summary = `${tableText}\n\n${rows.length - fails.length}/${rows.length} tests passed${flaky.length ? ` (${flaky.length} only when run alone: ${flaky.map((r) => r.test).join(', ')})` : ''} in ${(wall / 60000).toFixed(1)} min wall time, ${jobs} at a time; builds ${b.key} (debug sha256 ${b.debugSha.slice(0, 12)}, release ${b.releaseSha.slice(0, 12)}).
${fails.map((r) => `FAIL ${r.test}: ${r.why}\n`).join('')}Every input above is SIMULATED in headless Chromium on this machine: no real mouse, touch screen, controller, Steam Deck or Windows was used.`;
console.log(`\n${summary}`);
writeFileSync(join(runDir, 'summary.txt'), `${summary}\n`);
writeFileSync(join(runDir, 'summary.json'), JSON.stringify({ key: b.key, debugSha: b.debugSha, releaseSha: b.releaseSha, jobs, wallMs: wall, rows, runs: byName }, null, 1));
if (!existsSync(join(runDir, 'summary.txt'))) process.exit(2);
process.exit(fails.length ? 1 : 0);
