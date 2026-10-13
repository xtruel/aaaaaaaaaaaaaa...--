// Playwright is not a dependency of the game: it is looked up where it is installed.
// Order: the PLAYWRIGHT_MODULE environment variable (a module name or a path to the package folder), then Node's own
// resolution of 'playwright' from this repository, then the global install in /opt/node22/lib/node_modules.
import { createRequire } from 'module';

const here = createRequire(import.meta.url);
const tried = [];

function attempt(label, load) {
  try {
    const pw = load();
    if (pw?.chromium) return { pw, from: label };
    tried.push(`${label}: no chromium export`);
  } catch (e) {
    tried.push(`${label}: ${String(e.message).split('\n')[0]}`);
  }
  return null;
}

function resolve() {
  if (process.env.PLAYWRIGHT_MODULE) {
    const r = attempt(`PLAYWRIGHT_MODULE=${process.env.PLAYWRIGHT_MODULE}`, () => here(process.env.PLAYWRIGHT_MODULE));
    if (r) return r;
  }
  return (
    attempt("require('playwright') from the repository", () => here('playwright')) ??
    attempt('/opt/node22/lib/node_modules/playwright', () => createRequire('/opt/node22/lib/node_modules/')('playwright')) ??
    null
  );
}

const found = resolve();
if (!found) {
  throw new Error(`Playwright not found. Set PLAYWRIGHT_MODULE to its package folder. Tried:\n  ${tried.join('\n  ')}`);
}

export const playwright = found.pw;
export const chromium = found.pw.chromium;
export const playwrightFrom = found.from;
