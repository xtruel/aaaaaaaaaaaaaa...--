// npm run steam:appid -- <AppID>   writes steam_appid.txt next to the local builds in release/
// npm run steam:appid -- --remove  deletes it again
// Only for testing a build started outside the Steam client (with Steam running and logged in): when Steam starts
// the game it passes the App ID itself. Without an App ID (argument or STEAM_APP_ID) it uses 480, Valve's test app
// "Spacewar". steam/content never gets this file (scripts/steam-content.cjs skips it).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dirs = ['release/win-unpacked', 'release/linux-unpacked'].filter((d) => fs.existsSync(path.join(root, d)));
const arg = process.argv[2];

if (!dirs.length) {
  console.error('steam:appid: no build in release/ yet - run npm run dist:steam (or dist:win / dist:linux) first');
  process.exit(1);
}

if (arg === '--remove') {
  for (const d of dirs) fs.rmSync(path.join(root, d, 'steam_appid.txt'), { force: true });
  console.log(`steam:appid: removed steam_appid.txt from ${dirs.join(', ')}`);
  process.exit(0);
}

const appId = String(arg ?? process.env.STEAM_APP_ID ?? '480').trim();
if (!/^[1-9]\d{0,9}$/.test(appId)) {
  console.error(`steam:appid: "${appId}" is not a Steam App ID (a positive number)`);
  process.exit(1);
}
for (const d of dirs) fs.writeFileSync(path.join(root, d, 'steam_appid.txt'), `${appId}\n`);
console.log(`steam:appid: wrote steam_appid.txt (${appId}${appId === '480' ? ', Valve test app Spacewar' : ''}) in ${dirs.join(', ')}`);
