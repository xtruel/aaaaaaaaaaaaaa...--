// Trailer step 1 runner: node scripts/trailer/saves.mjs --game <game checkout> --out <saves.json>
// Bundles make-saves.mjs with esbuild ("@game/..." = the game checkout) and runs it with Node.
// The game checkout is only read; the bundle is written next to --out.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, def) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
const game = path.resolve(opt('--game', path.join(here, '..', '..')));
const out = path.resolve(opt('--out', 'saves.json'));
if (!fs.existsSync(path.join(game, 'src', 'game', 'sim.ts'))) {
  console.error(`saves: ${game} is not a Scrapbot City checkout (src/game/sim.ts missing)`);
  process.exit(2);
}
// esbuild from this project, or from the game checkout
const require = createRequire(import.meta.url);
let esbuild;
try {
  esbuild = require('esbuild');
} catch {
  esbuild = createRequire(path.join(game, 'package.json'))('esbuild');
}
fs.mkdirSync(path.dirname(out), { recursive: true });
const bundle = path.join(path.dirname(out), 'make-saves.bundle.mjs');
await esbuild.build({
  entryPoints: [path.join(here, 'make-saves.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
  logLevel: 'warning',
  plugins: [
    {
      name: 'game-alias',
      setup(b) {
        b.onResolve({ filter: /^@game\// }, async (a) => {
          const r = await b.resolve('./' + a.path.slice('@game/'.length), { resolveDir: game, kind: a.kind });
          return r.errors.length ? { errors: r.errors } : { path: r.path };
        });
      },
    },
  ],
});
const json = execFileSync(process.execPath, [bundle], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'inherit'] });
fs.writeFileSync(out, json);
const data = JSON.parse(json);
console.log(data.report.join('\n'));
console.log(`saves: ${Object.keys(data.storage).length} storage keys -> ${out}`);
