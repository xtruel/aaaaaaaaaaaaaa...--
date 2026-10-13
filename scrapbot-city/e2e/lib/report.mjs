// One test = one Node process started by e2e/run.mjs with its configuration as JSON in argv[2] (or run by hand:
// node e2e/tests/<file>.mjs '{"input":"mouse"}', the builds then come from the cache of this checkout).
// The reporter prints one line per check (PASS / FAIL), keeps notes and screenshots, and writes result.json in the
// test's output folder; the process exits 1 when a check failed or the test crashed.
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { INPUT_LABEL } from './input.mjs';
import { settle } from './page.mjs';

export async function startTest(defaults = {}) {
  let cfg = {};
  if (process.argv[2]) cfg = JSON.parse(process.argv[2]);
  cfg = { ...defaults, ...cfg };
  if (!cfg.debug || !cfg.release) {
    const { ensureBuilds } = await import('./build.mjs');
    const b = ensureBuilds({ quiet: true });
    cfg.debug ??= b.debug;
    cfg.release ??= b.release;
    cfg.out ??= join(b.dir, 'runs', 'manual', cfg.name ?? 'test');
  }
  cfg.out ??= join(process.cwd(), '.cache', 'e2e', 'manual', cfg.name ?? 'test');
  rmSync(join(cfg.out, 'shots'), { recursive: true, force: true });
  mkdirSync(join(cfg.out, 'shots'), { recursive: true });
  const t0 = Date.now();
  const checks = [];
  const notes = [];
  const shots = [];
  let crashed = null;
  const tag = cfg.name ?? 'test';
  const line = (s) => console.log(s);
  const T = {
    cfg,
    input: cfg.input ?? null,
    inputLabel: INPUT_LABEL[cfg.input] ?? cfg.inputLabel ?? 'none (DOM reads only)',
    ok(name, cond, detail = '') {
      const pass = !!cond;
      checks.push({ ok: pass, name, detail: String(detail ?? '').slice(0, 1500) });
      line(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== '' && detail !== undefined ? ` — ${String(detail).replace(/\s+/g, ' ').slice(0, 600)}` : ''}`);
      return pass;
    },
    note(text) {
      notes.push(String(text));
      line(`  .. ${text}`);
    },
    // a screenshot of the page, numbered in the order taken
    async shot(page, name, opts = {}) {
      const file = join(cfg.out, 'shots', `${String(shots.length + 1).padStart(2, '0')}-${name.replace(/[^\w.-]+/g, '_')}.png`);
      // (the interface caught up with the city first: it is redrawn every 0.1 s)
      await settle(page).catch(() => {});
      await page.screenshot({ path: file, ...opts });
      shots.push(file);
      return file;
    },
    // the test's body; a throw is a failed check with the page's picture
    async run(body, pageFor = () => null) {
      try {
        await body();
      } catch (e) {
        crashed = e;
        T.ok(`the test ran to its end`, false, `${e.message}`.split('\n').slice(0, 8).join(' / '));
        const p = pageFor();
        if (p && !p.isClosed?.()) await T.shot(p, 'crash').catch(() => {});
        console.error(e);
      }
    },
    async finish(extra = {}) {
      const fail = checks.filter((c) => !c.ok).length;
      const result = {
        name: tag,
        input: cfg.input ?? null,
        inputLabel: T.inputLabel,
        build: cfg.build ?? null,
        pass: checks.length - fail,
        fail,
        crashed: crashed ? String(crashed.message).split('\n')[0] : null,
        ms: Date.now() - t0,
        checks,
        notes,
        shots,
        ...extra,
      };
      writeFileSync(join(cfg.out, 'result.json'), JSON.stringify(result, null, 1));
      line(`\n${result.pass}/${checks.length} checks passed (${tag}, input: ${T.inputLabel}) in ${(result.ms / 1000).toFixed(0)} s`);
      process.exit(fail || crashed || checks.length === 0 ? 1 : 0);
    },
  };
  line(`== ${tag} (input: ${T.inputLabel})`);
  return T;
}
