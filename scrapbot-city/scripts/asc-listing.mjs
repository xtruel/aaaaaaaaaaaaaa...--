// Scrapbot City's App Store listing from the repository, through the App Store Connect API (key: scripts/asc-api.mjs).
// Safe to run again: it writes only what differs. Submits nothing for review, sets no price.
//   node scripts/asc-listing.mjs [--dry]
// Texts: appstore/metadata/<locale>/*.txt and copyright.txt. Screenshots: appstore/screenshots/<locale>/<device>/NN-*.png
// (or .jpg), in name order, at most 10 per set.
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { api, all, appByBundleId, BUNDLE_ID } from './asc-api.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry');
const PAGE = 'https://claude.ai/artifact/RtuycNCpGDGdHCDPXLK5jz';
// The support page's anchors in each language (the page has English and Italian)
const ANCHORS = { it: { privacy: 'informativa', support: 'assistenza' } };
const DEVICES = {
  'iphone-6.9': { type: 'APP_IPHONE_67', sizes: ['2868x1320', '1320x2868'] },
  'ipad-13': { type: 'APP_IPAD_PRO_3GEN_129', sizes: ['2752x2064', '2064x2752'] },
};
const META = `${ROOT}/appstore/metadata`;
const SHOTS = `${ROOT}/appstore/screenshots`;
const VERSION = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8')).version;
const LIMITS = { name: 30, subtitle: 30, keywords: 100, promotional_text: 170, description: 4000 };

const text = (locale, name) => {
  const p = `${META}/${locale}/${name}.txt`;
  if (!existsSync(p)) return undefined;
  const t = readFileSync(p, 'utf8').trim();
  if (LIMITS[name] && [...t].length > LIMITS[name]) throw new Error(`${locale}/${name}.txt: ${[...t].length} > ${LIMITS[name]} characters`);
  return t;
};
const url = (locale, what) => `${PAGE}#${ANCHORS[locale]?.[what] ?? what}`;
const locales = readdirSync(META).filter((d) => statSync(`${META}/${d}`).isDirectory()).sort();

let writes = 0;
async function write(method, path, body, what) {
  writes++;
  console.log(`${DRY ? '[dry] ' : ''}${what}`);
  if (DRY) return { data: { id: 'DRY', attributes: {} } };
  return api(method, path, body);
}
// Only the attributes whose value differs from what App Store Connect has
const changed = (current, wanted) =>
  Object.fromEntries(Object.entries(wanted).filter(([k, v]) => v !== undefined && (current?.[k] ?? null) !== v));

const app = await appByBundleId(BUNDLE_ID);
if (!app) {
  console.error(`No app with bundle ID ${BUNDLE_ID} in App Store Connect: the owner creates it (My Apps → + → New App).`);
  process.exit(2);
}
console.log(`App ${app.attributes.name} (${app.id}), primary locale ${app.attributes.primaryLocale}, version ${VERSION}`);

// 1. App information: categories, then name, subtitle and privacy policy per locale
const infos = await all(`/v1/apps/${app.id}/appInfos`);
const info = infos.find((i) => (i.attributes.state ?? i.attributes.appStoreState) === 'PREPARE_FOR_SUBMISSION') ?? infos[0];
const cats = await api('GET', `/v1/appInfos/${info.id}?include=primaryCategory,primarySubcategoryOne,primarySubcategoryTwo`);
const rel = (k) => cats.data.relationships?.[k]?.data?.id ?? null;
const wantCats = { primaryCategory: 'GAMES', primarySubcategoryOne: 'GAMES_SIMULATION', primarySubcategoryTwo: 'GAMES_STRATEGY' };
if (Object.entries(wantCats).some(([k, v]) => rel(k) !== v)) {
  await write('PATCH', `/v1/appInfos/${info.id}`, {
    data: {
      type: 'appInfos', id: info.id,
      relationships: Object.fromEntries(Object.entries(wantCats).map(([k, v]) => [k, { data: { type: 'appCategories', id: v } }])),
    },
  }, 'Categories: Games, Simulation, Strategy');
}

const infoLocs = await all(`/v1/appInfos/${info.id}/appInfoLocalizations`);
for (const locale of locales) {
  const wanted = { name: text(locale, 'name'), subtitle: text(locale, 'subtitle'), privacyPolicyUrl: url(locale, 'privacy') };
  const cur = infoLocs.find((l) => l.attributes.locale === locale);
  if (!cur) {
    await write('POST', '/v1/appInfoLocalizations', {
      data: { type: 'appInfoLocalizations', attributes: { locale, ...wanted }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } },
    }, `App information ${locale}: added`);
  } else {
    const diff = changed(cur.attributes, wanted);
    if (Object.keys(diff).length) {
      await write('PATCH', `/v1/appInfoLocalizations/${cur.id}`, { data: { type: 'appInfoLocalizations', id: cur.id, attributes: diff } },
        `App information ${locale}: ${Object.keys(diff).join(', ')}`);
    }
  }
}

// 2. Age rating: no objectionable content, no ads, chat, web access, gambling or loot boxes → 4+
const AGE = {
  alcoholTobaccoOrDrugUseOrReferences: 'NONE', contests: 'NONE', gamblingSimulated: 'NONE', gunsOrOtherWeapons: 'NONE',
  medicalOrTreatmentInformation: 'NONE', profanityOrCrudeHumor: 'NONE', sexualContentGraphicAndNudity: 'NONE',
  sexualContentOrNudity: 'NONE', horrorOrFearThemes: 'NONE', matureOrSuggestiveThemes: 'NONE',
  violenceCartoonOrFantasy: 'NONE', violenceRealisticProlongedGraphicOrSadistic: 'NONE', violenceRealistic: 'NONE',
  advertising: false, gambling: false, healthOrWellnessTopics: false, lootBox: false, messagingAndChat: false,
  parentalControls: false, ageAssurance: false, socialMedia: false, socialMediaAgeRestricted: false,
  unrestrictedWebAccess: false, userGeneratedContent: false,
};
const age = await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
const ageDiff = changed(age.data.attributes, AGE);
if (Object.keys(ageDiff).length) {
  await write('PATCH', `/v1/ageRatingDeclarations/${age.data.id}`, { data: { type: 'ageRatingDeclarations', id: age.data.id, attributes: ageDiff } },
    `Age rating: ${Object.keys(ageDiff).length} answers`);
}

// 3. The version: number, copyright, manual release after approval; texts per locale
const versions = await all(`/v1/apps/${app.id}/appStoreVersions?filter%5Bplatform%5D=IOS`);
const state = (v) => v.attributes.appVersionState ?? v.attributes.appStoreState;
let version = versions.find((v) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(state(v)));
const copyright = readFileSync(`${META}/copyright.txt`, 'utf8').trim();
if (!version) {
  version = (await write('POST', '/v1/appStoreVersions', {
    data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: VERSION, copyright, releaseType: 'MANUAL' }, relationships: { app: { data: { type: 'apps', id: app.id } } } },
  }, `Version ${VERSION}: created`)).data;
} else {
  const diff = changed(version.attributes, { versionString: VERSION, copyright, releaseType: 'MANUAL' });
  if (Object.keys(diff).length) {
    await write('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: diff } },
      `Version ${VERSION}: ${Object.keys(diff).join(', ')}`);
  }
}
// "What's New" exists only from the second version on the store
const firstVersion = !versions.some((v) => v.id !== version.id);

const verLocs = version.id === 'DRY' ? [] : await all(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
const verLocIds = {};
for (const locale of locales) {
  const wanted = {
    description: text(locale, 'description'), keywords: text(locale, 'keywords'),
    promotionalText: text(locale, 'promotional_text'), supportUrl: url(locale, 'support'),
    whatsNew: firstVersion ? undefined : text(locale, 'release_notes'),
  };
  const cur = verLocs.find((l) => l.attributes.locale === locale);
  if (!cur) {
    const res = await write('POST', '/v1/appStoreVersionLocalizations', {
      data: { type: 'appStoreVersionLocalizations', attributes: { locale, ...wanted }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } },
    }, `Version texts ${locale}: added`);
    verLocIds[locale] = res.data.id;
  } else {
    verLocIds[locale] = cur.id;
    const diff = changed(cur.attributes, wanted);
    if (Object.keys(diff).length) {
      await write('PATCH', `/v1/appStoreVersionLocalizations/${cur.id}`, { data: { type: 'appStoreVersionLocalizations', id: cur.id, attributes: diff } },
        `Version texts ${locale}: ${Object.keys(diff).join(', ')}`);
    }
  }
}

// 4. Screenshots: a set per locale and device, replaced when the files differ (name or MD5)
function image(path) {
  const b = readFileSync(path);
  if (b.readUInt32BE(0) === 0x89504e47) {
    return { buf: b, size: `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`, alpha: b[25] === 4 || b[25] === 6 };
  }
  // JPEG: the size is in the first start-of-frame segment
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) throw new Error(`${path}: neither PNG nor JPEG`);
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { buf: b, size: `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`, alpha: false };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${path}: no image size found`);
}
const pending = [];
for (const locale of locales) {
  for (const [dir, dev] of Object.entries(DEVICES)) {
    const folder = `${SHOTS}/${locale}/${dir}`;
    if (!existsSync(folder)) { console.log(`Screenshots ${locale} ${dir}: no folder, skipped`); continue; }
    const files = readdirSync(folder).filter((f) => /^\d\d-.*\.(png|jpe?g)$/i.test(f)).sort().slice(0, 10).map((name) => {
      const p = image(`${folder}/${name}`);
      if (!dev.sizes.includes(p.size)) throw new Error(`${locale}/${dir}/${name}: ${p.size}, App Store wants ${dev.sizes.join(' or ')}`);
      if (p.alpha) throw new Error(`${locale}/${dir}/${name}: has an alpha channel`);
      return { name, buf: p.buf, md5: createHash('md5').update(p.buf).digest('hex') };
    });
    if (!files.length || DRY && !verLocIds[locale]) { console.log(`Screenshots ${locale} ${dir}: ${files.length} files${DRY ? ' (dry)' : ''}`); continue; }
    const locId = verLocIds[locale];
    const sets = locId === 'DRY' ? [] : await all(`/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets`);
    let set = sets.find((s) => s.attributes.screenshotDisplayType === dev.type);
    const have = set ? await all(`/v1/appScreenshotSets/${set.id}/appScreenshots`) : [];
    const same = have.length === files.length && have.every((s, i) => s.attributes.fileName === files[i].name && s.attributes.sourceFileChecksum === files[i].md5);
    if (same) continue;
    if (!set) {
      set = (await write('POST', '/v1/appScreenshotSets', {
        data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: dev.type }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } },
      }, `Screenshots ${locale} ${dir}: new set ${dev.type}`)).data;
    }
    for (const s of have) await write('DELETE', `/v1/appScreenshots/${s.id}`, undefined, `Screenshots ${locale} ${dir}: removed ${s.attributes.fileName}`);
    for (const f of files) {
      const res = await write('POST', '/v1/appScreenshots', {
        data: { type: 'appScreenshots', attributes: { fileName: f.name, fileSize: f.buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
      }, `Screenshots ${locale} ${dir}: upload ${f.name}`);
      if (DRY) continue;
      for (const op of res.data.attributes.uploadOperations) {
        const put = await fetch(op.url, {
          method: op.method,
          headers: Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])),
          body: f.buf.subarray(op.offset, op.offset + op.length),
        });
        if (!put.ok) throw new Error(`upload ${f.name}: ${put.status}`);
      }
      await api('PATCH', `/v1/appScreenshots/${res.data.id}`, { data: { type: 'appScreenshots', id: res.data.id, attributes: { uploaded: true, sourceFileChecksum: f.md5 } } });
      pending.push({ id: res.data.id, label: `${locale}/${dir}/${f.name}` });
    }
  }
}
// Apple processes each image: wait for it, report failures
for (const p of pending) {
  for (let i = 0; ; i++) {
    const s = await api('GET', `/v1/appScreenshots/${p.id}`);
    const st = s.data.attributes.assetDeliveryState;
    if (st?.state === 'COMPLETE') break;
    if (st?.state === 'FAILED' || i > 40) { console.log(`Screenshot ${p.label}: ${st?.state} ${JSON.stringify(st?.errors ?? [])}`); break; }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
console.log(`${writes ? `${writes} changes${DRY ? ' (dry run)' : ''}` : 'Listing already up to date'}; screenshots processed: ${pending.length}`);
