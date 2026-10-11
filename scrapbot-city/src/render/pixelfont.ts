// A 3x5 pixel font for text painted inside the game world (signs, floating numbers).
import { lang } from '../i18n';

const GLYPHS: Record<string, string> = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '110001010100111',
  '3': '110001010001110',
  '4': '101101111001001',
  '5': '111100110001110',
  '6': '011100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001110',
  '-': '000000111000000',
  '+': '000010111010000',
  '!': '010010010000010',
  '.': '000000000000010',
  ':': '000010000010000',
  '%': '101001010100101',
  ',': '000000000010100',
  '/': '001001010100100',
  "'": '010010000000000',
  '?': '110001010000010',
  '(': '010100100100010',
  ')': '010001001001010',
  '×': '000101010101000',
  // before -> after in module labels ("STORAGE 80 -> 180"; an arrow → is written -> too, see foldText)
  '>': '100010001010100',
  '<': '001010100010001',
  '=': '000111000111000',
  ' ': '000000000000000',
};

// Letters without their own decomposition, for Polish, Nordic and German text.
const FOLD: Record<string, string> = { Ł: 'L', Ø: 'O', Æ: 'AE', Œ: 'OE', ẞ: 'SS', Đ: 'D', Ð: 'D', Þ: 'TH' };
const UMLAUT: Record<string, string> = { Ä: 'AE', Ö: 'OE', Ü: 'UE' };

// The font only has A–Z: accents are dropped (É → E, Ż → Z, ß → SS) so every language still reads.
// German writes umlauts out instead (Ü → UE), the way it is done wherever they are missing.
// Arrows are too small for 3×5 pixels: → is written ->.
export function foldText(text: string): string {
  const up = text.toUpperCase();
  return (lang() === 'de' ? up.replace(/[ÄÖÜ]/g, (c) => UMLAUT[c]) : up)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ŁØÆŒẞĐÐÞ]/g, (c) => FOLD[c] ?? c)
    .replace(/→/g, '->');
}

export function pixelTextWidth(text: string, scale = 1): number {
  const n = [...foldText(text)].length;
  return n === 0 ? 0 : (n * 4 - 1) * scale;
}

const OUTLINE = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  outline?: string,
): void {
  const up = foldText(text);
  if (outline) for (const [ox, oy] of OUTLINE) paint(ctx, up, x + ox * scale, y + oy * scale, outline, scale);
  paint(ctx, up, x, y, color, scale);
}

function paint(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number): void {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) {
      if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, cy + Math.floor(i / 3) * scale, scale, scale);
    }
    cx += 4 * scale;
  }
}
