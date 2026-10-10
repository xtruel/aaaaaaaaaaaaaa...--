// Small pixel icons and portraits for the DOM interface, generated as data URLs.
import { BUILDINGS } from '../game/defs';
import type { BuildingType } from '../game/defs';
import type { Speaker } from '../game/story';
import { PAL, botSprite, buildingSprite, heroBotSprite, heroCatSprite, makeCanvas } from './sprites';

const ICON_PAL: Record<string, string> = {
  K: PAL.ink,
  W: PAL.white,
  w: '#b9b4cc',
  R: PAL.rust,
  r: PAL.rustD,
  S: PAL.steelL,
  s: PAL.steel,
  Y: PAL.yellow,
  O: PAL.orange,
  G: PAL.lime,
  g: PAL.limeD,
  P: PAL.pink,
  C: PAL.cyan,
  V: PAL.purple,
  N: PAL.green,
  B: PAL.sky,
};

const ICONS = {
  scrap: ['....KK..', '..KKRRK.', '.KRRrRK.', 'KSSKRrK.', 'KSsSKKKK', 'KsSsKwWK', '.KKKKWwK', '....KKK.'],
  parts: ['...KK...', '.KKSSKK.', '.KSSSSK.', 'KSSKKSSK', 'KSSKKSSK', '.KSSSSK.', '.KKSSKK.', '...KK...'],
  credits: ['..KKKK..', '.KYYYYK.', 'KYYOYYOK', 'KYOYYYYK', 'KYYOOYYK', 'KYYYYOYK', '.KOYYOK.', '..KKKK..'],
  energy: ['....KKK.', '...KYYK.', '..KYYK..', '.KYYYYK.', '.KKKYYK.', '..KYYK..', '.KYK....', '.KK.....'],
  pop: ['.P....P.', '.W....W.', 'WWWWWWWW', 'WKGKKGKW', 'WKKKKKKW', 'WWWPPWWW', '.wWWWWw.', '..w..w..'],
  happy: ['..KKKK..', '.KGGGGK.', 'KGKGGKGK', 'KGGGGGGK', 'KGKGGKGK', 'KGGKKGGK', '.KGGGGK.', '..KKKK..'],
  smog: ['........', '.KKK.KK.', 'KsssKssK', 'KsSssSsK', '.KssssK.', '..KKKK..', '.K.K.K..', 'K.K.K...'],
  bulldoze: ['........', '.KKKKK..', '.KYYYK..', 'KKYYYKKK', 'KYYYYYYK', 'KYYYYYYK', 'KKsKKsKK', '.KK..KK.'],
  leaf: ['.....KK.', '...KKNNK', '..KNNNNK', '.KNNgNK.', '.KNgNNK.', 'KNgKKK..', 'KgK.....', 'K.......'],
  play: ['.KK.....', '.KGKK...', '.KGGGKK.', '.KGGGGGK', '.KGGGGGK', '.KGGGKK.', '.KGKK...', '.KK.....'],
  disk: ['KKKKKKK.', 'KBBWWBKK', 'KBBWWBBK', 'KBBBBBBK', 'KBWWWWBK', 'KBWKKWBK', 'KBWWWWBK', 'KKKKKKKK'],
  door: ['.KKKKKK.', '.KVVVVK.', '.KVVVVK.', '.KVVYVK.', '.KVVVVK.', '.KVVVVK.', '.KVVVVK.', 'KKKKKKKK'],
  star: ['...KK...', '..KYYK..', 'KKKYYKKK', 'KYYYYYYK', '.KYYYYK.', '.KYKKYK.', 'KYK..KYK', 'KK....KK'],
  bulb: ['..KKKK..', '.KYYYYK.', 'KYYWYYYK', 'KYWYYYYK', '.KYYYYK.', '..KYYK..', '..KSSK..', '..KKKK..'],
  blimp: ['........', '.KKKKKK.', 'KPWWWWPK', 'KPWPPWPK', 'KPWWWWPK', '.KKKKKK.', '...KSK..', '...KKK..'],
  lock: ['..KKKK..', '.KK..KK.', '.K....K.', 'KKKKKKKK', 'KYYYYYYK', 'KYYKKYYK', 'KYYYYYYK', 'KKKKKKKK'],
  gear: ['..KKKK..', 'KKOOOOKK', 'KOOKKOOK', 'KOKSSKOK', 'KOKSSKOK', 'KOOKKOOK', 'KKOOOOKK', '..KKKK..'],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

const urlCache = new Map<string, string>();

function rowsToUrl(rows: string[], scale: number): string {
  const [c, ctx] = makeCanvas(rows[0].length * scale, rows.length * scale);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = ICON_PAL[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return c.toDataURL();
}

export function iconUrl(name: IconName, scale = 2): string {
  const key = `${name}@${scale}`;
  let url = urlCache.get(key);
  if (!url) {
    url = rowsToUrl(ICONS[name], scale);
    urlCache.set(key, url);
  }
  return url;
}

export function buildingThumb(type: BuildingType): string {
  const key = `thumb:${type}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const sp = buildingSprite(type);
  const size = 48;
  const [c, ctx] = makeCanvas(size, size);
  const scale = Math.min(1, size / Math.max(sp.canvas.width, sp.canvas.height));
  const w = Math.round(sp.canvas.width * scale);
  const h = Math.round(sp.canvas.height * scale);
  ctx.drawImage(sp.canvas, Math.round((size - w) / 2), size - h, w, h);
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}

export function portraitUrl(speaker: Speaker): string {
  const key = `portrait:${speaker}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const [c, ctx] = makeCanvas(32, 32);
  const bg: Record<Speaker, string> = {
    usa: '#2a2e52',
    miso: '#3b2a4f',
    corp: '#3a1a2c',
    citizens: '#203a3a',
    ppi: '#1f3a26',
  };
  ctx.fillStyle = bg[speaker];
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 32; y += 2) ctx.fillRect(0, y, 32, 1);
  switch (speaker) {
    case 'usa':
      ctx.drawImage(heroBotSprite(), 5, 4);
      break;
    case 'miso':
      ctx.drawImage(heroCatSprite(-1), 7, 9);
      break;
    case 'corp': {
      // a suit with a 2PM pin and dark visor
      const p = (x: number, y: number, w: number, h: number, col: string) => {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, w, h);
      };
      p(9, 5, 14, 13, PAL.ink);
      p(10, 6, 12, 11, '#d9c7b8');
      p(10, 6, 12, 3, '#22202e');
      p(10, 10, 12, 3, PAL.ink);
      p(12, 11, 3, 1, PAL.red);
      p(18, 11, 3, 1, PAL.red);
      p(13, 15, 6, 1, '#8a6f62');
      p(5, 19, 22, 13, PAL.ink);
      p(6, 20, 20, 12, '#2b2940');
      p(14, 20, 4, 10, PAL.white);
      p(15, 21, 2, 8, PAL.pink);
      p(8, 23, 3, 2, PAL.pink);
      break;
    }
    case 'citizens':
      ctx.drawImage(botSprite(1, 1), 0, 0, 8, 9, 1, 12, 16, 18);
      ctx.drawImage(botSprite(0, -1), 0, 0, 8, 9, 15, 12, 16, 18);
      ctx.drawImage(botSprite(0, 1), 0, 0, 8, 9, 8, 2, 16, 18);
      break;
    case 'ppi': {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(7, 5, 18, 22);
      ctx.fillRect(5, 7, 22, 18);
      ctx.fillStyle = PAL.sky;
      ctx.fillRect(8, 6, 16, 20);
      ctx.fillRect(6, 8, 20, 16);
      ctx.fillStyle = PAL.green;
      ctx.fillRect(9, 9, 6, 5);
      ctx.fillRect(16, 15, 7, 6);
      ctx.fillRect(10, 18, 4, 3);
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(22, 4, 4, 2);
      ctx.fillRect(24, 2, 2, 2);
      break;
    }
  }
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}

export function pathColor(type: BuildingType): string {
  const path = BUILDINGS[type].path;
  return path === 'green' ? 'var(--green)' : path === 'industrial' ? 'var(--industrial)' : 'var(--muted)';
}
