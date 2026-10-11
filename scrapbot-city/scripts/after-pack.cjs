// electron-builder afterPack hook (package.json "build.afterPack").
// Windows: electron-builder is told not to edit the .exe (win.signAndEditExecutable=false), because on Linux
// that needs wine. Instead the icon and the version info are written here with resedit, which is pure JS,
// so the Windows build for Steam can be made on any OS.
const fs = require('fs');
const path = require('path');

// "0.6.0" -> [0, 6, 0, 0]; pre-release tags ("0.7.0-beta.1") are dropped from the numeric version.
function versionParts(version) {
  const parts = String(version).split(/[.+-]/).slice(0, 4).map((p) => Number.parseInt(p, 10));
  while (parts.length < 4) parts.push(0);
  return parts.map((n) => (Number.isFinite(n) && n >= 0 && n <= 0xffff ? n : 0));
}

async function editWindowsExe(context) {
  const { NtExecutable, NtExecutableResource, Resource, Data } = await import('resedit');
  const { packager, appOutDir } = context;
  const info = packager.appInfo;
  const exeName = `${info.productFilename}.exe`;
  const exe = path.join(appOutDir, exeName);
  const iconRel = packager.platformSpecificBuildOptions.icon || 'build/icon.ico';
  const iconFile = path.resolve(packager.projectDir, iconRel);
  if (!fs.existsSync(exe)) throw new Error(`after-pack: ${exe} not found`);
  if (!iconFile.endsWith('.ico') || !fs.existsSync(iconFile)) {
    throw new Error(`after-pack: the Windows icon ${iconFile} is missing (win.icon must be an .ico file)`);
  }

  // Electron's own exe is signed; editing it would break that signature anyway, so it is dropped.
  const executable = NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const resource = NtExecutableResource.from(executable);

  // Icon: replace Electron's icon group in place (same id and language), as rcedit --set-icon does.
  const groups = Resource.IconGroupEntry.fromEntries(resource.entries);
  if (groups.length < 1) throw new Error(`after-pack: no icon group in ${exeName}`);
  const ico = Data.IconFile.from(fs.readFileSync(iconFile));
  Resource.IconGroupEntry.replaceIconsForResource(
    resource.entries,
    groups[0].id,
    groups[0].lang,
    ico.icons.map((icon) => icon.data),
  );

  // Version info: what Windows shows in the file's Properties, Task Manager and firewall prompts.
  const versions = Resource.VersionInfo.fromEntries(resource.entries);
  if (versions.length !== 1) throw new Error(`after-pack: expected one version resource in ${exeName}, found ${versions.length}`);
  const vi = versions[0];
  const languages = vi.getAllLanguagesForStringValues();
  const lang = languages[0] ?? { lang: 1033, codepage: 1200 };
  const [a, b, c, d] = versionParts(info.version);
  vi.setFileVersion(a, b, c, d, lang.lang);
  vi.setProductVersion(a, b, c, d, lang.lang);
  vi.setStringValues(lang, {
    ProductName: info.productName,
    FileDescription: info.productName,
    CompanyName: info.companyName || 'Qwerty3D Games',
    LegalCopyright: info.copyright,
    FileVersion: info.version,
    ProductVersion: info.version,
    InternalName: info.productFilename,
    OriginalFilename: exeName,
  });
  // left over from Electron's own exe: only meaningful to the Squirrel installer, which the Steam build does not use
  vi.removeStringValue(lang, 'SquirrelAwareVersion');
  vi.outputToResourceEntries(resource.entries);

  resource.outputResource(executable);
  fs.writeFileSync(exe, Buffer.from(executable.generate()));
  console.log(`  • after-pack: ${exeName} icon (${ico.icons.length} sizes) and version info ${info.productName} ${info.version} set`);
}

// Both platforms: the licences of what the game ships that is not ours, in <install folder>/licenses/. The six fonts
// are inside dist/index.html; SIL OFL 1.1 and Apache 2.0 ask for their copyright notice and licence text to travel
// with them. Electron's and Chromium's licences are already in the root (LICENSE.electron.txt, LICENSES.chromium.html).
const FONTS = [
  ['bungee', 'Bungee'],
  ['dotgothic16', 'DotGothic16'],
  ['lilita-one', 'Lilita One'],
  ['nunito', 'Nunito'],
  ['permanent-marker', 'Permanent Marker'],
  ['silkscreen', 'Silkscreen'],
];
function writeNotices(context) {
  const root = context.packager.projectDir;
  const dir = path.join(context.appOutDir, 'licenses');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  const lines = [
    'Scrapbot City - third-party components',
    '',
    'Fonts (embedded in the game, from the @fontsource npm packages):',
  ];
  for (const [pkg, family] of FONTS) {
    const base = path.join(root, 'node_modules', '@fontsource', pkg);
    const meta = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
    const text = fs.readFileSync(path.join(base, 'LICENSE'), 'utf8');
    // OFL files open with the copyright line; the Apache 2.0 text of Permanent Marker has none, and its notice
    // ("Copyright (c) 2010 by Font Diner, Inc.") is in the package README: Apache 2.0 section 4 asks to keep it.
    const readme = path.join(base, 'README.md');
    const copyright = (
      text.match(/^Copyright[^\n]*/m) ??
      (fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8').match(/^Copyright[^\n]*/m) : null) ?? ['']
    )[0].trim();
    const noticeInText = /^Copyright/m.test(text);
    fs.writeFileSync(path.join(dir, 'fonts', `${pkg}-LICENSE.txt`), noticeInText || !copyright ? text : `${copyright}\n\n${text}`);
    lines.push(`  ${family} - ${meta.license}${copyright ? ` - ${copyright}` : ''} - fonts/${pkg}-LICENSE.txt`);
  }
  const sw = path.join(root, 'node_modules', 'steamworks.js');
  if (fs.existsSync(sw)) {
    fs.copyFileSync(path.join(sw, 'LICENSE'), path.join(dir, 'steamworks.js-LICENSE.txt'));
    const v = JSON.parse(fs.readFileSync(path.join(sw, 'package.json'), 'utf8')).version;
    lines.push('', `steamworks.js ${v} - MIT - steamworks.js-LICENSE.txt`);
    lines.push('Steamworks API (steam_api64.dll / libsteam_api.so) - (c) Valve Corporation, redistributed under the Steamworks SDK Access Agreement');
  }
  lines.push('', 'Electron - MIT - ../LICENSE.electron.txt', 'Chromium and its components - ../LICENSES.chromium.html', '');
  fs.writeFileSync(path.join(dir, 'THIRD-PARTY-NOTICES.txt'), lines.join('\n'));
  console.log(`  • after-pack: licenses/ written (${FONTS.length} fonts${fs.existsSync(sw) ? ', steamworks.js' : ''})`);
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'win32') await editWindowsExe(context);
  writeNotices(context);
};
