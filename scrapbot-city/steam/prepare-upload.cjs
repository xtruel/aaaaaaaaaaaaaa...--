// Checks everything SteamPipe needs before an upload and writes steam/sdk/app_build.generated.vdf, the copy of
// app_build.vdf that steamcmd actually runs (with the build description, Preview and SetLive filled in).
// Called by steam/upload.sh and steam/upload.bat; can also be run by hand:
//   node steam/prepare-upload.cjs [<steam_user>] [--beta <branch>] [--preview] [--desc "text"] [--check]
//   --beta <branch>  set the build live on that branch after the upload (never "default": Valve wants that by hand)
//   --preview        dry run: steamcmd scans the files and writes logs to steam/output, uploads nothing
//   --desc "text"    build description shown in Steamworks > SteamPipe > Builds (default: version, commit, date)
//   --check          only check, write nothing
// Messages go to stderr; exit code 0 = ready, 1 = something to fix (each problem is listed).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const steamDir = __dirname;
const sdkDir = path.join(steamDir, 'sdk');
const root = path.resolve(steamDir, '..');
const appBuildFile = path.join(sdkDir, 'app_build.vdf');
const generatedFile = path.join(sdkDir, 'app_build.generated.vdf');

// Executable each depot must contain, by depot script name (the Linux one also needs the executable bit).
const EXPECTED = {
  'depot_build_windows.vdf': { exe: 'Scrapbot City.exe', os: 'Windows' },
  'depot_build_linux.vdf': { exe: 'scrapbot-city', os: 'Linux', unixExe: true },
};

const problems = [];
const warnings = [];
const fail = (msg) => problems.push(msg);
const warn = (msg) => warnings.push(msg);
const log = (msg) => process.stderr.write(`${msg}\n`);

// ---------- arguments ----------
const opts = { beta: null, preview: false, desc: null, check: false, user: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--beta' || a === '--desc') {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
      fail(`${a} needs a value, e.g. ${a === '--beta' ? '--beta beta' : '--desc "first beta"'}`);
      continue;
    }
    opts[a.slice(2)] = argv[++i];
  } else if (a === '--preview') opts.preview = true;
  else if (a === '--check') opts.check = true;
  else if (a === '-h' || a === '--help') {
    log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(0);
  } else if (a.startsWith('-')) fail(`unknown option ${a} (see steam/README.md)`);
  else if (opts.user === null) opts.user = a;
  else fail('only one name is expected (your Steam build account). Never pass the password: steamcmd asks for it.');
}
if (opts.user !== null && !/^[A-Za-z0-9_.@-]+$/.test(opts.user)) {
  fail(`"${opts.user}" does not look like a Steam account name (letters, digits, _ . - only)`);
}
if (opts.beta !== null) {
  if (/^(default|public)$/i.test(opts.beta)) {
    fail(`--beta ${opts.beta}: Steam never lets a script set the default branch live. Upload to a beta branch, test it, ` +
      'then set the build live on "default" in Steamworks > SteamPipe > Builds.');
  } else if (!/^[a-z0-9_-]{1,64}$/.test(opts.beta)) {
    fail(`--beta "${opts.beta}": use the branch name exactly as created in Steamworks (lowercase letters, digits, - and _)`);
  }
}

// ---------- a small KeyValues (VDF) reader: quoted/unquoted strings, { }, // comments ----------
function parseVdf(text, file) {
  let i = 0;
  let line = 1;
  const err = (msg) => {
    throw new Error(`${path.relative(root, file)} line ${line}: ${msg}`);
  };
  function token() {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) {
        if (text[i] === '\n') line++;
        i++;
      }
      if (text.startsWith('//', i)) {
        while (i < text.length && text[i] !== '\n') i++;
        continue;
      }
      break;
    }
    if (i >= text.length) return null;
    const c = text[i];
    if (c === '{' || c === '}') {
      i++;
      return { t: c, line };
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\n') err('a quoted string is not closed');
        if (text[i] === '\\' && i + 1 < text.length) {
          const n = text[i + 1];
          s += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          i += 2;
        } else s += text[i++];
      }
      if (i >= text.length) err('a quoted string is not closed');
      i++;
      return { t: 'str', v: s, line };
    }
    let s = '';
    while (i < text.length && !/[\s{}"]/.test(text[i])) s += text[i++];
    return { t: 'str', v: s, line };
  }
  function block(top) {
    const entries = [];
    for (;;) {
      const k = token();
      if (k === null) {
        if (!top) err('a { is never closed');
        return entries;
      }
      if (k.t === '}') {
        if (top) err('there is a } too many');
        return entries;
      }
      if (k.t !== 'str') err(`expected a key, found "${k.t}"`);
      const v = token();
      if (v === null) err(`key "${k.v}" has no value`);
      if (v.t === '{') entries.push({ key: k.v, value: block(false), line: k.line });
      else if (v.t === 'str') entries.push({ key: k.v, value: v.v, line: k.line });
      else err(`key "${k.v}" is followed by "}"`);
    }
  }
  return block(true);
}
const get = (entries, key) => entries.filter((e) => e.key.toLowerCase() === key.toLowerCase());
const one = (entries, key) => get(entries, key)[0];

function readVdf(file) {
  try {
    return parseVdf(fs.readFileSync(file, 'utf8'), file);
  } catch (e) {
    fail(e.code === 'ENOENT' ? `${path.relative(root, file)} is missing` : e.message);
    return null;
  }
}

const isRealId = (v) => /^[1-9][0-9]{0,9}$/.test(String(v));
const isPlaceholder = (v) => /^0[0-9]*$/.test(String(v)); // 0000000, 0000001, 0000002: real IDs never start with 0
const rel = (p) => path.relative(root, p) || '.';

// ---------- app_build.vdf ----------
const appText = fs.existsSync(appBuildFile) ? fs.readFileSync(appBuildFile, 'utf8') : null;
const app = readVdf(appBuildFile);
let appId = null;
const depots = [];
if (app) {
  const ab = one(app, 'AppBuild');
  if (!ab || typeof ab.value === 'string') fail('steam/sdk/app_build.vdf: the "AppBuild" { ... } block is missing');
  else {
    const e = ab.value;
    const id = one(e, 'AppID');
    if (!id) fail('steam/sdk/app_build.vdf: "AppID" is missing');
    else if (isPlaceholder(id.value)) {
      fail(`steam/sdk/app_build.vdf line ${id.line}: "AppID" is still the placeholder ${id.value}. ` +
        'Write the App ID Steamworks gave you (steam/README.md, step 1).');
    } else if (!isRealId(id.value)) fail(`steam/sdk/app_build.vdf line ${id.line}: "AppID" "${id.value}" is not a number`);
    else appId = id.value;
    for (const k of ['Desc', 'Preview', 'SetLive']) {
      if (get(e, k).length !== 1) fail(`steam/sdk/app_build.vdf: keep exactly one "${k}" line (the upload scripts fill it in)`);
    }
    const contentRoot = one(e, 'ContentRoot');
    if (!contentRoot) fail('steam/sdk/app_build.vdf: "ContentRoot" is missing');
    const ds = one(e, 'Depots');
    if (!ds || typeof ds.value === 'string' || !ds.value.length) fail('steam/sdk/app_build.vdf: the "Depots" { ... } block is missing or empty');
    else {
      for (const d of ds.value) {
        if (isPlaceholder(d.key)) {
          fail(`steam/sdk/app_build.vdf line ${d.line}: depot ${d.key} (${d.value}) is still a placeholder. ` +
            'Write the depot ID from Steamworks > SteamPipe > Depots (steam/README.md, step 2).');
        } else if (!isRealId(d.key)) fail(`steam/sdk/app_build.vdf line ${d.line}: depot "${d.key}" is not a number`);
        if (typeof d.value !== 'string') fail(`steam/sdk/app_build.vdf line ${d.line}: depot ${d.key} must name a depot_build_*.vdf file`);
        else depots.push({ id: d.key, script: d.value, line: d.line });
      }
      const ids = depots.map((d) => d.id);
      if (new Set(ids).size !== ids.length) fail('steam/sdk/app_build.vdf: the same depot ID is listed twice');
      if (appId && ids.includes(appId)) fail('steam/sdk/app_build.vdf: a depot ID cannot be the App ID (depots usually are App ID + 1, + 2)');
    }
  }
}

// ---------- depot scripts and their content ----------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// What a build packs in resources/app.asar: its package.json version and its copy of dist/index.html
// (read with @electron/asar, installed with electron-builder; null when it cannot be read).
let asarLib = null;
try {
  asarLib = require(require.resolve('@electron/asar', { paths: [root] }));
} catch {
  asarLib = null;
}
function fromAsar(asarFile, inner) {
  try {
    return asarLib ? asarLib.extractFile(asarFile, inner) : null;
  } catch {
    return null;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const distHtml = path.join(root, 'dist', 'index.html');
const summary = [];

for (const d of depots) {
  const file = path.join(sdkDir, d.script);
  const dep = readVdf(file);
  if (!dep) continue;
  const db = one(dep, 'DepotBuild');
  const name = `steam/sdk/${d.script}`;
  if (!db || typeof db.value === 'string') {
    fail(`${name}: the "DepotBuild" { ... } block is missing`);
    continue;
  }
  const e = db.value;
  const id = one(e, 'DepotID');
  if (!id) fail(`${name}: "DepotID" is missing`);
  else if (isPlaceholder(id.value)) {
    fail(`${name} line ${id.line}: "DepotID" is still the placeholder ${id.value}. Write the same depot ID as in app_build.vdf.`);
  } else if (id.value !== d.id && !isPlaceholder(d.id)) {
    fail(`${name} line ${id.line}: "DepotID" is ${id.value} but app_build.vdf line ${d.line} gives this file depot ${d.id}. They must match.`);
  }
  const mappings = get(e, 'FileMapping');
  if (!mappings.length) fail(`${name}: no "FileMapping" block, nothing would be uploaded`);
  const exclusions = get(e, 'FileExclusion').map((x) => x.value);
  for (const must of ['*.pdb', 'steam_appid.txt']) {
    if (!exclusions.includes(must)) fail(`${name}: keep the line "FileExclusion" "${must}"`);
  }
  const cr = one(e, 'ContentRoot');
  const contentDir = path.resolve(sdkDir, cr ? cr.value : '../content/');
  const exp = EXPECTED[d.script];
  if (!fs.existsSync(contentDir) || !fs.statSync(contentDir).isDirectory()) {
    fail(`${rel(contentDir)} does not exist: run "npm run dist:steam" first (it fills steam/content/windows and steam/content/linux)`);
    continue;
  }
  const files = walk(contentDir);
  if (!files.length) {
    fail(`${rel(contentDir)} is empty: run "npm run dist:steam"`);
    continue;
  }
  let bytes = 0;
  for (const f of files) bytes += fs.lstatSync(f).size;
  if (exp) {
    const exe = path.join(contentDir, exp.exe);
    if (!fs.existsSync(exe)) fail(`${rel(exe)} is missing: run "npm run dist:steam"`);
    else if (exp.unixExe && process.platform !== 'win32' && !(fs.statSync(exe).mode & 0o111)) {
      fail(`${rel(exe)} is not executable: run "npm run dist:steam" again on Linux or macOS (or chmod +x it)`);
    }
  }
  if (files.some((f) => path.basename(f) === 'steam_appid.txt')) {
    warn(`${rel(contentDir)} contains steam_appid.txt: it is excluded from the upload, but it should not be there (npm run dist:steam never copies it)`);
  }
  const asarFile = path.join(contentDir, 'resources', 'app.asar');
  let version = null;
  let built = null;
  if (!fs.existsSync(asarFile)) fail(`${rel(asarFile)} is missing: run "npm run dist:steam"`);
  else {
    const packedPkg = fromAsar(asarFile, 'package.json');
    try {
      version = packedPkg ? JSON.parse(packedPkg.toString('utf8')).version : null;
    } catch {
      version = null;
    }
    built = fs.statSync(asarFile).mtime;
    if (version && version !== pkg.version) {
      warn(`${rel(contentDir)} holds version ${version} but package.json says ${pkg.version}: run "npm run dist:steam" if you meant to upload ${pkg.version}`);
    }
    // Is the game in this build the one in dist/? Compare the bytes when the asar can be read, else the dates.
    if (fs.existsSync(distHtml)) {
      const packedGame = fromAsar(asarFile, 'dist/index.html');
      const stale = packedGame ? !packedGame.equals(fs.readFileSync(distHtml)) : fs.statSync(distHtml).mtime > built;
      if (stale) {
        warn(`the game in ${rel(asarFile)} is not the one in dist/index.html (rebuilt since). Run "npm run dist:steam" to upload the latest game.`);
      }
    }
  }
  summary.push(
    `  depot ${d.id} ${exp ? exp.os.padEnd(8) : ''}${rel(contentDir)}: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MiB` +
      `${version ? `, version ${version}` : ''}${built ? `, built ${built.toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}`,
  );
}

// ---------- description ----------
function gitInfo() {
  try {
    const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return dirty ? `${hash}+changes` : hash;
  } catch {
    return 'no git';
  }
}
const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
const desc = (opts.desc ?? `Scrapbot City ${pkg.version} (${gitInfo()}) ${stamp} UTC`)
  .replace(/["\\\s]+/g, ' ')
  .trim()
  .slice(0, 200);

// ---------- result ----------
for (const w of warnings) log(`WARNING: ${w}`);
if (problems.length) {
  log(`\nNot ready to upload (${problems.length} problem${problems.length > 1 ? 's' : ''}):`);
  for (const p of problems) log(`  - ${p}`);
  log('\nsteam/README.md explains each step.');
  process.exit(1);
}

log(`App ${appId}: ${depots.length} depot${depots.length > 1 ? 's' : ''}`);
for (const s of summary) log(s);
log(`  description: ${desc}`);
log(`  set live on: ${opts.beta ? `branch "${opts.beta}" (it must already exist in Steamworks > SteamPipe > Builds)` : 'no branch (set it by hand in Steamworks > SteamPipe > Builds)'}`);
log(`  mode: ${opts.preview ? 'PREVIEW (nothing is uploaded; logs in steam/output)' : 'upload'}`);
if (opts.check) {
  log('Check only: nothing written.');
  process.exit(0);
}

// Same file with only the three values replaced, so comments and layout stay as the owner wrote them.
function setValue(text, key, value) {
  const re = new RegExp(`^(\\s*"${key}"\\s+)"[^"\\n]*"`, 'mi');
  if (!re.test(text)) throw new Error(`cannot find "${key}" in app_build.vdf`);
  return text.replace(re, `$1"${value}"`);
}
let out = appText;
out = setValue(out, 'Desc', desc);
out = setValue(out, 'Preview', opts.preview ? '1' : '0');
out = setValue(out, 'SetLive', opts.beta ?? '');
out = `// GENERATED by steam/prepare-upload.cjs from app_build.vdf on ${stamp} UTC - do not edit, it is deleted after the upload.\n${out}`;

// read it back: the values steamcmd will see must be the ones we meant
const ab = one(parseVdf(out, generatedFile), 'AppBuild').value;
const check = { Desc: desc, Preview: opts.preview ? '1' : '0', SetLive: opts.beta ?? '', AppID: appId };
for (const [k, v] of Object.entries(check)) {
  if (one(ab, k)?.value !== v) {
    log(`Internal error: ${k} in the generated script is "${one(ab, k)?.value}", expected "${v}"`);
    process.exit(1);
  }
}
fs.writeFileSync(generatedFile, out);
log(`Wrote ${rel(generatedFile)}`);
