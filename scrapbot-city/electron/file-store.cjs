// The desktop build's saves as files (electron/main.cjs wires these to the page through preload.cjs): one small file
// per storage key in the saves folder, synced by Steam Cloud. Kept apart from Electron so the tests can run it.
const fs = require('fs');
const path = require('path');
const { usable } = require('./storage-utils.cjs');

function createFileStore(dir) {
  // One small file per storage key: save_city-home.sav, campaign.sav, settings.sav...
  const fileFor = (key) => path.join(dir(), `${String(key).replace(/[^a-zA-Z0-9-]/g, '_')}.sav`);

  function readText(file) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      return text.length ? text : null;
    } catch {
      return null;
    }
  }

  // Write next to the file, then rename over it: a crash mid-save never leaves half a city behind.
  // The previous good version stays as .bak and is used if the main file is ever missing or damaged;
  // a damaged file is never copied over a good backup.
  function writeAtomic(key, file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, value, 'utf8');
    if (usable(key, readText(file))) fs.copyFileSync(file, `${file}.bak`);
    fs.renameSync(tmp, file);
  }

  // A damaged main file read in place of its .bak is copied aside first, as it is: <file>.damaged-<n>, one copy per
  // text, never overwritten or removed (the next save writes over the main file). What it held is never lost.
  const kept = new Set();
  function keepDamaged(file, text) {
    const id = `${file}\n${text}`;
    if (kept.has(id)) return;
    for (let n = 1; ; n++) {
      const copy = `${file}.damaged-${n}`;
      const there = readText(copy);
      if (there === text) break;
      if (there !== null) continue;
      try {
        fs.writeFileSync(copy, text, 'utf8');
      } catch (err) {
        console.log(`Could not keep a copy of ${file}: ${err.message}`);
        return;
      }
      break;
    }
    kept.add(id);
  }

  return {
    fileFor,
    // the stored text: the main file, or its .bak when the main one is missing or damaged
    get(key) {
      const file = fileFor(key);
      const main = readText(file);
      if (usable(key, main)) return main;
      const bak = readText(`${file}.bak`);
      if (!usable(key, bak)) return main;
      if (main !== null) keepDamaged(file, main);
      return bak;
    },
    // the main file's text as it is, damaged or not (null when it is missing or as good as get's): the projects
    // profile merges what can be read from a damaged one with the .bak (src/profile.ts)
    getDamaged(key) {
      const main = readText(fileFor(key));
      return main !== null && !usable(key, main) ? main : null;
    },
    set(key, value) {
      try {
        writeAtomic(key, fileFor(key), String(value));
        return true;
      } catch (err) {
        console.log(`Could not save ${key}: ${err.message}`);
        return false;
      }
    },
    remove(key) {
      const file = fileFor(key);
      for (const f of [file, `${file}.bak`]) fs.rmSync(f, { force: true });
      return true;
    },
  };
}

module.exports = { createFileStore };
