#!/usr/bin/env node
// The iOS app's icon and launch images (npm run ios:assets), made again from the game's own pictures:
//  - ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png: build/icon.png (1024x1024) laid on the
//    game's night colour (src/style.css --night), written WITHOUT an alpha channel (App Store Connect refuses an icon
//    with one);
//  - ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png: the main menu's logo, drawn by the game itself
//    in Chromium (its fonts, from the release build), centred on the night colour. The launch screen shows the image
//    "aspect fill": only the middle shows on a wide or tall screen, so the logo keeps inside 1500x900 of 2732x2732
//    (an iPhone in landscape shows about 2732x1260 of it, an iPad in portrait about 1900x2732).
// Needs Playwright as the e2e suite does (e2e/lib/playwright.mjs). PNGs are encoded here (node:zlib): RGB, 8 bit.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { deflateSync } from 'zlib';
import { ensureBuilds, ROOT } from '../e2e/lib/build.mjs';
import { chromium } from '../e2e/lib/playwright.mjs';
import { serve } from '../e2e/lib/server.mjs';

const css = readFileSync(join(ROOT, 'src', 'style.css'), 'utf8');
const NIGHT = /--night:\s*(#[0-9a-f]{6})/i.exec(css)[1];
const rgb = [1, 3, 5].map((i) => parseInt(NIGHT.slice(i, i + 2), 16));
const ASSETS = join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets');
const SPLASH = 2732;
const LOGO_BOX = [1500, 900];

// ---------- PNG, RGB 8 bit ----------
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function pngRGB(width, height, pixels /* RGB, row after row */) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB, no alpha
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// RGBA pixels laid on the night colour, at (x0, y0) of a width x height RGB picture of that colour
function flatten(width, height, layer) {
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) out.set(rgb, i * 3);
  const { x0, y0, w, h, data } = layer;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const a = data[s + 3] / 255;
      const d = ((y0 + y) * width + x0 + x) * 3;
      for (let c = 0; c < 3; c++) out[d + c] = Math.round(data[s + c] * a + rgb[c] * (1 - a));
    }
  return out;
}

const b = ensureBuilds({ quiet: true });
const server = await serve(b.release);
const browser = await chromium.launch();
try {
  // ---------- the logo, as the main menu draws it ----------
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 4 });
  const page = await ctx.newPage();
  await page.goto(server.url);
  await page.waitForSelector('#menu:not([hidden]) .logo', { state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  const clip = await page.evaluate(() => {
    document.body.classList.add('reduce-motion');
    for (const el of document.querySelectorAll('.menu-bg, .menu-shade, .crt, .menu-ui > *:not(.menu-left), .menu-left > *:not(.logo)')) el.style.visibility = 'hidden';
    for (const el of [document.documentElement, document.body, document.getElementById('menu')]) el.style.background = 'transparent';
    const boxes = [document.querySelector('.logo'), ...document.querySelectorAll('.logo *')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    // (its outlines and drips are shadows and pseudo-elements a little outside the boxes)
    const l = Math.min(...boxes.map((r) => r.left)) - 24;
    const t = Math.min(...boxes.map((r) => r.top)) - 24;
    return { x: l, y: t, width: Math.max(...boxes.map((r) => r.right)) + 24 - l, height: Math.max(...boxes.map((r) => r.bottom)) + 40 - t };
  });
  await page.waitForTimeout(300);
  const logoPng = await page.screenshot({ clip, omitBackground: true });

  // ---------- scaled and read back as pixels in a canvas ----------
  const pixels = await page.evaluate(
    async ([logo, icon, box]) => {
      const load = (src) => new Promise((res, rej) => Object.assign(new Image(), { onload() { res(this); }, onerror: rej, src }));
      const read = (img, w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        let s = '';
        for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
        return btoa(s);
      };
      const L = await load(`data:image/png;base64,${logo}`);
      const k = Math.min(box[0] / L.naturalWidth, box[1] / L.naturalHeight);
      const w = Math.round(L.naturalWidth * k);
      const h = Math.round(L.naturalHeight * k);
      const I = await load(`data:image/png;base64,${icon}`);
      return { logo: { w, h, data: read(L, w, h) }, icon: { w: 1024, h: 1024, data: read(I, 1024, 1024) } };
    },
    [logoPng.toString('base64'), readFileSync(join(ROOT, 'build', 'icon.png')).toString('base64'), LOGO_BOX],
  );

  const icon = pngRGB(1024, 1024, flatten(1024, 1024, { x0: 0, y0: 0, w: 1024, h: 1024, data: Buffer.from(pixels.icon.data, 'base64') }));
  writeFileSync(join(ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), icon);
  const { w, h } = pixels.logo;
  const splash = pngRGB(SPLASH, SPLASH, flatten(SPLASH, SPLASH, { x0: Math.round((SPLASH - w) / 2), y0: Math.round((SPLASH - h) / 2), w, h, data: Buffer.from(pixels.logo.data, 'base64') }));
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) writeFileSync(join(ASSETS, 'Splash.imageset', name), splash);
  console.log(`night ${NIGHT}; icon 1024x1024 RGB (${icon.length} bytes); splash ${SPLASH}x${SPLASH} RGB with the logo ${w}x${h} centred (${splash.length} bytes); from the release build ${b.key}`);
} finally {
  await browser.close();
  await server.close();
}
