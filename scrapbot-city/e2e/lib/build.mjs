// The two builds every test runs on, made from this checkout with the project's own Vite:
//   debug:   NODE_ENV=development vite build --mode development (has the window.scrapbot hook, used to READ the city
//            and to stage scenes; never to press anything)
//   release: vite build (no hook: what players get)
// Both go to .cache/e2e/<commit>/{debug,release}/index.html; a checkout with changes to the game's files gets
// <commit>-dirty-<hash of the changes> so that a build never stands for a commit it does not come from.
import { createHash } from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// what goes into a build: a change anywhere here makes the checkout "dirty" for the e2e cache
const BUILD_INPUTS = ['src', 'index.html', 'vite.config.ts', 'package.json', 'tsconfig.json'];
export const HOOK_MARKER = /scrapbot\s*:\s*\{\s*session\s*:/;

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

export function checkoutKey() {
  const commit = git('rev-parse', '--short=7', 'HEAD');
  const status = git('status', '--porcelain', '--untracked-files=all', '--', ...BUILD_INPUTS);
  if (!status) return { commit, dirty: false, key: commit };
  const h = createHash('sha256');
  h.update(git('diff', 'HEAD', '--', ...BUILD_INPUTS));
  for (const line of status.split('\n')) {
    if (!line.startsWith('??')) continue;
    const f = join(ROOT, line.slice(3));
    h.update(f);
    if (existsSync(f)) h.update(readFileSync(f));
  }
  return { commit, dirty: true, key: `${commit}-dirty-${h.digest('hex').slice(0, 10)}` };
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function viteBuild(outDir, debug, log) {
  const vite = join(ROOT, 'node_modules', '.bin', 'vite');
  const args = ['build', ...(debug ? ['--mode', 'development'] : []), '--outDir', outDir, '--emptyOutDir'];
  const env = { ...process.env };
  if (debug) env.NODE_ENV = 'development';
  else delete env.NODE_ENV;
  const r = spawnSync(vite, args, { cwd: ROOT, env, encoding: 'utf8' });
  writeFileSync(log, `${vite} ${args.join(' ')}${debug ? ' (NODE_ENV=development)' : ''}\n\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  if (r.status !== 0) throw new Error(`vite build failed (${debug ? 'debug' : 'release'}), see ${log}`);
}

// Returns { key, commit, dirty, dir, debug, release, debugHtml, releaseHtml, debugSha, releaseSha, built }.
// E2E_DEBUG_DIR / E2E_RELEASE_DIR point the suite at builds made elsewhere (then nothing is built).
export function ensureBuilds({ rebuild = false, quiet = false } = {}) {
  const say = (s) => quiet || console.log(s);
  const k = checkoutKey();
  const dir = join(ROOT, '.cache', 'e2e', k.key);
  mkdirSync(dir, { recursive: true });
  const out = { ...k, dir, debug: process.env.E2E_DEBUG_DIR ?? join(dir, 'debug'), release: process.env.E2E_RELEASE_DIR ?? join(dir, 'release'), built: [] };
  for (const [kind, folder, given] of [
    ['debug', out.debug, !!process.env.E2E_DEBUG_DIR],
    ['release', out.release, !!process.env.E2E_RELEASE_DIR],
  ]) {
    const html = join(folder, 'index.html');
    if (given) {
      if (!existsSync(html)) throw new Error(`${kind} build not found: ${html}`);
      continue;
    }
    // a dirty checkout changes between runs: build again each time; a clean commit is built once
    if (!rebuild && !k.dirty && existsSync(html)) continue;
    say(`building ${kind} -> ${folder}`);
    viteBuild(folder, kind === 'debug', join(dir, `build-${kind}.log`));
    out.built.push(kind);
  }
  out.debugHtml = join(out.debug, 'index.html');
  out.releaseHtml = join(out.release, 'index.html');
  out.debugSha = sha256(out.debugHtml);
  out.releaseSha = sha256(out.releaseHtml);
  const dbg = readFileSync(out.debugHtml, 'utf8');
  const rel = readFileSync(out.releaseHtml, 'utf8');
  out.debugHook = HOOK_MARKER.test(dbg);
  out.releaseHook = HOOK_MARKER.test(rel);
  if (!out.debugHook) throw new Error(`the debug build has no window.scrapbot hook: ${out.debugHtml}`);
  if (out.releaseHook) throw new Error(`the release build carries the window.scrapbot hook: ${out.releaseHtml}`);
  writeFileSync(join(dir, 'BUILD.json'), JSON.stringify({ ...out, at: new Date().toISOString() }, null, 1));
  return out;
}
