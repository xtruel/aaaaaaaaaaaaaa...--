// npm run steam:check — checks the steamworks.js native binaries against the installed Electron, without Steam.
//
// 1. Static checks (any OS): versions of Electron (and the Node / N-API it embeds) and of steamworks.js; for the
//    Windows x64 and Linux x64 binaries: present, sha256, architecture, the libraries they need (VCRUNTIME140,
//    libsteam_api.so...), the glibc they require (Linux) and the newest N-API function they use, compared with the
//    N-API version Electron provides. With the packaged builds in release/ it also checks that they carry the very
//    same binaries, and that the Windows exe exports every N-API function the Windows module looks up.
// 2. Load test (only on the OS the binary is for, here Linux): starts the installed Electron as Node
//    (ELECTRON_RUN_AS_NODE=1), loads steamworks.js and calls init() without an App ID and with 480 (Spacewar).
//    Without a running Steam client init() must throw, and the process must carry on.
//
// It never contacts Steam and never needs an account. Output: a report on stdout; --json <file> also writes it as JSON.
// Exit code 1 when a check fails ("not checkable here" is not a failure).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const results = [];
let failed = false;
function report(status, name, detail) {
  results.push({ status, name, detail });
  if (status === 'FAIL') failed = true;
  console.log(`${status.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`);
}

// N-API version that introduced each function the steamworks.js modules use (Node.js N-API docs, "N-API version
// matrix"). Functions not listed here are N-API 1-3.
const NAPI_VERSION_OF = {
  napi_create_bigint_int64: 6,
  napi_create_bigint_uint64: 6,
  napi_create_bigint_words: 6,
  napi_get_value_bigint_int64: 6,
  napi_get_value_bigint_uint64: 6,
  napi_get_value_bigint_words: 6,
  napi_get_all_property_names: 6,
  napi_set_instance_data: 6,
  napi_get_instance_data: 6,
  napi_detach_arraybuffer: 7,
  napi_is_detached_arraybuffer: 7,
  napi_type_tag_object: 8,
  napi_check_object_type_tag: 8,
  napi_object_freeze: 8,
  napi_object_seal: 8,
  napi_add_async_cleanup_hook: 8,
  napi_remove_async_cleanup_hook: 8,
  napi_create_date: 5,
  napi_is_date: 5,
  napi_get_date_value: 5,
  napi_add_finalizer: 5,
  napi_create_threadsafe_function: 4,
  napi_get_threadsafe_function_context: 4,
  napi_call_threadsafe_function: 4,
  napi_acquire_threadsafe_function: 4,
  napi_release_threadsafe_function: 4,
  napi_unref_threadsafe_function: 4,
  napi_ref_threadsafe_function: 4,
  napi_add_env_cleanup_hook: 3,
  napi_remove_env_cleanup_hook: 3,
  napi_fatal_exception: 3,
  napi_open_callback_scope: 3,
  napi_close_callback_scope: 3,
  napi_get_uv_event_loop: 2,
};
const napiNeeded = (names) => names.reduce((m, n) => Math.max(m, NAPI_VERSION_OF[n] ?? 1), 1);

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// ---------- minimal ELF64 reader: needed libraries, runpath, required symbol versions, undefined napi_* symbols ----------
function readElf(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x7f454c46 || b[4] !== 2 || b[5] !== 1) throw new Error('not a little-endian ELF64 file');
  const machine = b.readUInt16LE(18);
  const shoff = Number(b.readBigUInt64LE(40));
  const shentsize = b.readUInt16LE(58);
  const shnum = b.readUInt16LE(60);
  const sections = [];
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    sections.push({
      type: b.readUInt32LE(o + 4),
      offset: Number(b.readBigUInt64LE(o + 24)),
      size: Number(b.readBigUInt64LE(o + 32)),
      link: b.readUInt32LE(o + 40),
      info: b.readUInt32LE(o + 44),
      entsize: Number(b.readBigUInt64LE(o + 56)),
    });
  }
  const str = (sec, off) => {
    const start = sec.offset + off;
    return b.toString('latin1', start, b.indexOf(0, start));
  };
  const SHT_DYNSYM = 11;
  const SHT_DYNAMIC = 6;
  const SHT_VERNEED = 0x6ffffffe;
  const needed = [];
  let runpath = null;
  const versions = new Set();
  const napi = [];
  for (const sec of sections) {
    if (sec.type === SHT_DYNAMIC) {
      const strtab = sections[sec.link];
      for (let o = sec.offset; o < sec.offset + sec.size; o += 16) {
        const tag = Number(b.readBigInt64LE(o));
        const val = Number(b.readBigUInt64LE(o + 8));
        if (tag === 1) needed.push(str(strtab, val));
        if (tag === 29 || tag === 15) runpath = str(strtab, val);
      }
    } else if (sec.type === SHT_VERNEED) {
      const strtab = sections[sec.link];
      let o = sec.offset;
      for (let i = 0; i < sec.info; i++) {
        const cnt = b.readUInt16LE(o + 2);
        let a = o + b.readUInt32LE(o + 8);
        for (let j = 0; j < cnt; j++) {
          versions.add(str(strtab, b.readUInt32LE(a + 8)));
          a += b.readUInt32LE(a + 12);
        }
        o += b.readUInt32LE(o + 12);
      }
    } else if (sec.type === SHT_DYNSYM) {
      const strtab = sections[sec.link];
      for (let o = sec.offset; o < sec.offset + sec.size; o += 24) {
        const shndx = b.readUInt16LE(o + 6);
        const name = str(strtab, b.readUInt32LE(o));
        if (shndx === 0 && name.startsWith('napi_')) napi.push(name);
      }
    }
  }
  const glibc = [...versions].filter((v) => v.startsWith('GLIBC_')).sort((x, y) => cmpVer(x.slice(6), y.slice(6)));
  return { machine: machine === 0x3e ? 'x86-64' : `machine ${machine}`, needed, runpath, glibc: glibc.at(-1) ?? null, napi: [...new Set(napi)].sort() };
}

function cmpVer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

// ---------- minimal PE32+ reader: imported DLLs, exported names, napi_* names looked up at run time ----------
function readPe(file) {
  const b = fs.readFileSync(file);
  const pe = b.readUInt32LE(0x3c);
  if (b.readUInt32LE(pe) !== 0x4550) throw new Error('not a PE file');
  const machine = b.readUInt16LE(pe + 4);
  const nsec = b.readUInt16LE(pe + 6);
  const optSize = b.readUInt16LE(pe + 20);
  const opt = pe + 24;
  if (b.readUInt16LE(opt) !== 0x20b) throw new Error('not PE32+ (64-bit)');
  const sections = [];
  for (let i = 0; i < nsec; i++) {
    const o = opt + optSize + i * 40;
    sections.push({ vsize: b.readUInt32LE(o + 8), va: b.readUInt32LE(o + 12), rawsize: b.readUInt32LE(o + 16), raw: b.readUInt32LE(o + 20) });
  }
  const off = (rva) => {
    const s = sections.find((x) => rva >= x.va && rva < x.va + Math.max(x.vsize, x.rawsize));
    if (!s) throw new Error(`RVA ${rva.toString(16)} outside the sections`);
    return rva - s.va + s.raw;
  };
  const cstr = (o) => b.toString('latin1', o, b.indexOf(0, o));
  const exportRva = b.readUInt32LE(opt + 112);
  const importRva = b.readUInt32LE(opt + 120);
  const imports = [];
  if (importRva) {
    for (let o = off(importRva); ; o += 20) {
      const nameRva = b.readUInt32LE(o + 12);
      if (!nameRva) break;
      imports.push(cstr(off(nameRva)));
    }
  }
  const exports = [];
  if (exportRva) {
    const e = off(exportRva);
    const n = b.readUInt32LE(e + 24);
    const names = off(b.readUInt32LE(e + 32));
    for (let i = 0; i < n; i++) exports.push(cstr(off(b.readUInt32LE(names + 4 * i))));
  }
  // napi-rs on Windows resolves N-API from the host process at run time (GetProcAddress): the names are stored as
  // strings, back to back without separators, so a run like "napi_anapi_b" is split at each "napi_"
  const napi = [...new Set((b.toString('latin1').match(/napi_[a-z0-9_]+/g) ?? []).flatMap((run) => run.split(/(?=napi_)/)))].sort();
  return { machine: machine === 0x8664 ? 'x86-64' : `machine 0x${machine.toString(16)}`, imports, exports, napi };
}

// ---------- 1. versions ----------
const electronPkg = path.join(root, 'node_modules', 'electron', 'package.json');
const steamPkg = path.join(root, 'node_modules', 'steamworks.js', 'package.json');
if (!fs.existsSync(electronPkg) || !fs.existsSync(steamPkg)) {
  report('FAIL', 'node_modules', 'electron or steamworks.js is not installed: run npm install');
  process.exit(1);
}
const electronVersion = readJson(electronPkg).version;
const steamworks = readJson(steamPkg);
report('INFO', 'Electron installed', `electron ${electronVersion} (package.json asks for ${readJson(path.join(root, 'package.json')).devDependencies.electron})`);
report('INFO', 'steamworks.js installed', `${steamworks.version} (MIT; built by its authors with napi-rs; their own Electron test app uses electron ${steamworks.devDependencies?.electron ?? '?'})`);

// What the installed Electron embeds (Node, N-API, ABI): asked to the Electron binary itself when it can run here.
let electronInfo = null;
const electronBin = (() => {
  try {
    return require(path.join(root, 'node_modules', 'electron'));
  } catch {
    return null;
  }
})();
if (electronBin && fs.existsSync(electronBin)) {
  const r = spawnSync(electronBin, ['-p', 'JSON.stringify(process.versions)'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 60000 });
  try {
    electronInfo = JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {
    electronInfo = null;
  }
}
if (electronInfo) {
  report('INFO', 'Electron runtime', `Electron ${electronInfo.electron}, Node ${electronInfo.node}, N-API ${electronInfo.napi}, NODE_MODULE_VERSION ${electronInfo.modules}, Chromium ${electronInfo.chrome}`);
} else {
  report('NOTE', 'Electron runtime', `the installed Electron binary cannot run on this OS (${process.platform}); N-API of Electron 33 is 9 (Node 20)`);
}
const electronNapi = Number(electronInfo?.napi ?? 9);

// ---------- 2. binaries ----------
const dist = path.join(root, 'node_modules', 'steamworks.js', 'dist');
const BIN = {
  linux: { node: 'linux64/steamworksjs.linux-x64-gnu.node', lib: 'linux64/libsteam_api.so' },
  windows: { node: 'win64/steamworksjs.win32-x64-msvc.node', lib: 'win64/steam_api64.dll' },
};
const hashes = {};
for (const [os, files] of Object.entries(BIN)) {
  for (const rel of Object.values(files)) {
    const f = path.join(dist, rel);
    if (!fs.existsSync(f)) {
      report('FAIL', `${os}: ${rel}`, 'missing');
      continue;
    }
    hashes[rel] = sha256(f);
    report('INFO', `${os}: ${rel}`, `${fs.statSync(f).size} bytes, sha256 ${hashes[rel]}`);
  }
}

let linuxNapi = null;
let linuxImports = [];
const linuxNode = path.join(dist, BIN.linux.node);
if (fs.existsSync(linuxNode)) {
  const elf = readElf(linuxNode);
  linuxNapi = napiNeeded(elf.napi);
  linuxImports = elf.napi;
  const libOk = elf.needed.includes('libsteam_api.so') && elf.runpath === '$ORIGIN';
  report(elf.machine === 'x86-64' ? 'PASS' : 'FAIL', 'linux: module architecture', elf.machine);
  report(libOk ? 'PASS' : 'FAIL', 'linux: finds libsteam_api.so next to itself', `NEEDED ${elf.needed.join(', ')}; RUNPATH ${elf.runpath}`);
  report('INFO', 'linux: newest glibc symbol required', `${elf.glibc} (the module does not load on systems with an older glibc: then the game runs without Steam features)`);
  report(linuxNapi <= electronNapi ? 'PASS' : 'FAIL', 'linux: N-API', `${elf.napi.length} N-API functions imported, newest from N-API ${linuxNapi}; Electron provides N-API ${electronNapi}. N-API is ABI-stable: the module does not depend on Electron's NODE_MODULE_VERSION`);
  const lib = readElf(path.join(dist, BIN.linux.lib));
  report('INFO', 'linux: libsteam_api.so', `needs ${lib.needed.join(', ')}; newest glibc symbol ${lib.glibc}`);
}

let winNapiNames = [];
const winNode = path.join(dist, BIN.windows.node);
if (fs.existsSync(winNode)) {
  const pe = readPe(winNode);
  winNapiNames = pe.napi;
  const winNapi = napiNeeded(pe.napi);
  report(pe.machine === 'x86-64' ? 'PASS' : 'FAIL', 'windows: module architecture', pe.machine);
  report(pe.imports.includes('steam_api64.dll') ? 'PASS' : 'FAIL', 'windows: imports steam_api64.dll', pe.imports.join(', '));
  const vc = pe.imports.filter((d) => /^vcruntime|^msvcp/i.test(d));
  report('NOTE', 'windows: needs the Visual C++ 2015-2022 runtime (x64)', `${vc.join(', ') || 'none'} — Electron does not ship it: tick "VC++ 2015-2022 Redist (x64)" in Steamworks > Installation > Redistributables`);
  // napi-rs looks up every N-API function it knows (up to N-API ${winNapi}) and only fails if a missing one is called;
  // the functions the code really calls are the ones the Linux build of the same source imports
  const used = linuxImports.length ? napiNeeded(linuxImports) : winNapi;
  report(used <= electronNapi ? 'PASS' : 'FAIL', 'windows: N-API', `napi-rs looks up ${pe.napi.length} N-API names at run time (newest N-API ${winNapi}); the code calls functions up to N-API ${used} (same source as the Linux module); Electron provides N-API ${electronNapi}`);
  const dll = readPe(path.join(dist, BIN.windows.lib));
  report('INFO', 'windows: steam_api64.dll', `imports ${dll.imports.join(', ')}`);
}

// ---------- 3. packaged builds (npm run dist:steam) ----------
const PACKS = [
  { os: 'linux', dir: 'release/linux-unpacked', files: BIN.linux },
  { os: 'windows', dir: 'release/win-unpacked', files: BIN.windows },
];
for (const p of PACKS) {
  const base = path.join(root, p.dir, 'resources', 'app.asar.unpacked', 'node_modules', 'steamworks.js', 'dist');
  if (!fs.existsSync(path.join(root, p.dir))) {
    report('NOTE', `${p.os}: packaged build`, `${p.dir} not built (npm run dist:steam)`);
    continue;
  }
  const same = Object.values(p.files).every((rel) => fs.existsSync(path.join(base, rel)) && sha256(path.join(base, rel)) === hashes[rel]);
  report(same ? 'PASS' : 'FAIL', `${p.os}: packaged build carries the same binaries`, `${p.dir}/resources/app.asar.unpacked/node_modules/steamworks.js/dist`);
  if (p.os === 'windows') {
    const lib = path.join(base, 'win64', 'steam_api64.lib');
    report(!fs.existsSync(lib) ? 'PASS' : 'NOTE', 'windows: the .lib import library (only for compiling) is not shipped', path.relative(root, lib));
  }
}
const exe = path.join(root, 'release', 'win-unpacked', 'Scrapbot City.exe');
if (fs.existsSync(exe) && winNapiNames.length) {
  const pe = readPe(exe);
  const exported = new Set(pe.exports);
  const version = (fs.readFileSync(exe).toString('latin1').match(/Electron\/(\d+\.\d+\.\d+)/) ?? [])[1];
  report(version === electronVersion ? 'PASS' : 'FAIL', 'windows: packaged exe is the installed Electron', `Scrapbot City.exe says Electron/${version}`);
  const used = linuxImports.length ? linuxImports : winNapiNames;
  const missingUsed = used.filter((n) => !exported.has(n));
  // (enum values, types and the module's own entry point show up among the strings too: they are not functions)
  const missingKnown = winNapiNames.filter((n) => !exported.has(n) && !/^napi_(ok|value|asy|pending_exception|register_module_v\d+|rs_)/.test(n));
  report(
    missingUsed.length === 0 ? 'PASS' : 'FAIL',
    'windows: the exe exports every N-API function the module calls',
    `${pe.exports.filter((n) => n.startsWith('napi_')).length} napi_* exports; of the ${used.length} functions called, missing: ${missingUsed.join(', ') || 'none'}; of the ${winNapiNames.length} names napi-rs looks up, not exported: ${missingKnown.join(', ') || 'none'}`,
  );
} else {
  report('NOTE', 'windows: packaged exe', 'release/win-unpacked not built: export check skipped');
}

// ---------- 4. load test inside Electron (this OS only) ----------
const LOAD_TEST = `
const out = { loaded: false };
try {
  const sw = require(process.env.SW_PATH);
  out.loaded = true;
  out.api = Object.keys(sw).sort();
  for (const appId of [undefined, 480]) {
    try {
      const c = sw.init(appId);
      out['init_' + (appId || 'none')] = 'OK (a Steam client answered): ' + typeof c;
    } catch (e) {
      out['init_' + (appId || 'none')] = 'threw: ' + String(e && e.message || e).split('\\n')[0];
    }
  }
} catch (e) {
  out.error = String(e && e.message || e).split('\\n')[0];
}
out.stillRunning = true;
console.log('RESULT ' + JSON.stringify(out));
process.exit(0);
`;
const here = { linux: process.platform === 'linux' && process.arch === 'x64', windows: process.platform === 'win32' && process.arch === 'x64' };
for (const os of ['linux', 'windows']) {
  if (!here[os]) {
    report('NOTE', `${os}: load test`, `not possible on ${process.platform}-${process.arch}: to be verified on ${os === 'windows' ? 'Windows 10/11 x64' : 'Linux x64 / Steam Deck'}`);
    continue;
  }
  if (!electronInfo) {
    report('NOTE', `${os}: load test`, 'the Electron binary cannot run here');
    continue;
  }
  const targets = [{ label: 'node_modules', dir: path.join(root, 'node_modules', 'steamworks.js') }];
  const packed = path.join(root, os === 'linux' ? 'release/linux-unpacked' : 'release/win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', 'steamworks.js');
  if (fs.existsSync(packed)) targets.push({ label: 'packaged build', dir: packed });
  for (const t of targets) {
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', SW_PATH: t.dir };
    for (const k of ['SteamAppId', 'SteamGameId', 'STEAM_APP_ID', 'SteamEnv']) delete env[k];
    const r = spawnSync(electronBin, ['-e', LOAD_TEST], { env, encoding: 'utf8', timeout: 60000, cwd: fs.mkdtempSync(path.join(require('os').tmpdir(), 'sw-load-')) });
    const line = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULT '));
    const res = line ? JSON.parse(line.slice(7)) : { error: `no result (exit ${r.status}, signal ${r.signal}): ${(r.stderr || '').trim().split('\n').pop()}` };
    const okLoad = res.loaded === true;
    report(okLoad ? 'PASS' : 'FAIL', `${os}: steamworks.js loads in Electron ${electronVersion} (${t.label})`, okLoad ? `exports ${res.api.join(', ')}` : res.error);
    if (okLoad) {
      const clean = /threw/.test(res.init_none) && /threw/.test(res.init_480) && res.stillRunning;
      report(clean ? 'PASS' : 'NOTE', `${os}: init() without a Steam client fails cleanly (${t.label})`, `no App ID: ${res.init_none}; App ID 480: ${res.init_480}; process carried on: ${res.stillRunning}; exit code ${r.status}`);
    }
  }
}

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify({ date: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, results }, null, 2));
}
console.log(failed ? '\nsteam:check — at least one check FAILED' : '\nsteam:check — no failures (NOTE lines are for the owner to verify elsewhere)');
process.exit(failed ? 1 : 0);
