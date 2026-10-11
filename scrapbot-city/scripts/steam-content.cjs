// npm run dist:steam, last step: copies the two builds in release/ to steam/content/<os>, the ContentRoot that
// SteamPipe uploads (one depot per folder). Each folder is replaced as a whole, so no stale file is uploaded;
// a steam_appid.txt left by "npm run steam:appid" is never copied (Steam starts the game with its own App ID).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const builds = [
  {
    os: 'windows',
    from: 'release/win-unpacked',
    must: ['Scrapbot City.exe', 'resources/app.asar', 'resources/app.asar.unpacked/node_modules/steamworks.js/dist/win64/steam_api64.dll', 'resources/app.asar.unpacked/node_modules/steamworks.js/dist/win64/steamworksjs.win32-x64-msvc.node'],
  },
  {
    os: 'linux',
    from: 'release/linux-unpacked',
    must: ['scrapbot-city', 'resources/app.asar', 'resources/app.asar.unpacked/node_modules/steamworks.js/dist/linux64/libsteam_api.so', 'resources/app.asar.unpacked/node_modules/steamworks.js/dist/linux64/steamworksjs.linux-x64-gnu.node'],
  },
];

function sizeOf(dir) {
  let bytes = 0;
  let files = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const s = sizeOf(p);
      bytes += s.bytes;
      files += s.files;
    } else {
      bytes += fs.lstatSync(p).size;
      files++;
    }
  }
  return { bytes, files };
}

let failed = false;
for (const b of builds) {
  const from = path.join(root, b.from);
  const to = path.join(root, 'steam', 'content', b.os);
  const missing = b.must.filter((f) => !fs.existsSync(path.join(from, f)));
  if (missing.length) {
    console.error(`steam-content: ${b.from} is missing ${missing.join(', ')} - run the build first`);
    failed = true;
    continue;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src) => path.basename(src) !== 'steam_appid.txt',
  });
  const { bytes, files } = sizeOf(to);
  console.log(`steam-content: ${b.from} -> steam/content/${b.os} (${files} files, ${(bytes / 1048576).toFixed(1)} MiB)`);
}
process.exit(failed ? 1 : 0);
