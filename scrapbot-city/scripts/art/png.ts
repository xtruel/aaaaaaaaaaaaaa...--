// Minimal PNG codec for the art pipeline: RGBA8 encode, and decode of the common 8-bit formats
// (RGBA, RGB, grey, grey+alpha, palette) so hand-edited overrides from any pixel editor load.
import { deflateSync, inflateSync } from 'node:zlib';

export interface Image {
  w: number;
  h: number;
  data: Uint8ClampedArray; // RGBA, row-major
}

export function createImage(w: number, h: number): Image {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

export function encodePNG(img: Image): Uint8Array {
  const { w, h, data } = img;
  const stride = w * 4;
  // per-row filter choice (None / Sub / Up) by smallest sum of absolute values: pixel art compresses well
  const raw = new Uint8Array((stride + 1) * h);
  const cand = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const cur = data[row + i];
      const left = i >= 4 ? data[row + i - 4] : 0;
      const up = y > 0 ? data[row - stride + i] : 0;
      cand[0][i] = cur;
      cand[1][i] = (cur - left) & 255;
      cand[2][i] = (cur - up) & 255;
    }
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 3; f++) {
      let s = 0;
      const c = cand[f];
      for (let i = 0; i < stride; i++) s += c[i] < 128 ? c[i] : 256 - c[i];
      if (s < bestScore) {
        bestScore = s;
        best = f;
      }
    }
    const o = y * (stride + 1);
    raw[o] = best === 0 ? 0 : best === 1 ? 1 : 2;
    raw.set(cand[best], o + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = deflateSync(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(idat)), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function decodePNG(buf: Uint8Array): Image {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ctype = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (off < buf.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = dv.getUint32(off + 8);
      h = dv.getUint32(off + 12);
      depth = body[8];
      ctype = body[9];
      interlace = body[12];
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`PNG: only 8-bit, non-interlaced images are supported (got depth ${depth}, interlace ${interlace})`);
  const channels = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 4 ? 2 : 1;
  const bpp = channels;
  const stride = w * bpp;
  const joined = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of idat) {
    joined.set(p, o);
    o += p.length;
  }
  const raw = new Uint8Array(inflateSync(joined));
  const pix = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const dst = pix.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pix.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? dst[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      dst[i] = v & 255;
    }
  }
  const img = createImage(w, h);
  for (let i = 0; i < w * h; i++) {
    const d = i * 4;
    if (ctype === 6) {
      img.data[d] = pix[i * 4];
      img.data[d + 1] = pix[i * 4 + 1];
      img.data[d + 2] = pix[i * 4 + 2];
      img.data[d + 3] = pix[i * 4 + 3];
    } else if (ctype === 2) {
      img.data[d] = pix[i * 3];
      img.data[d + 1] = pix[i * 3 + 1];
      img.data[d + 2] = pix[i * 3 + 2];
      img.data[d + 3] = 255;
    } else if (ctype === 4) {
      img.data[d] = img.data[d + 1] = img.data[d + 2] = pix[i * 2];
      img.data[d + 3] = pix[i * 2 + 1];
    } else if (ctype === 0) {
      img.data[d] = img.data[d + 1] = img.data[d + 2] = pix[i];
      img.data[d + 3] = 255;
    } else if (ctype === 3 && palette) {
      const k = pix[i];
      img.data[d] = palette[k * 3];
      img.data[d + 1] = palette[k * 3 + 1];
      img.data[d + 2] = palette[k * 3 + 2];
      img.data[d + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return img;
}

export function blit(dst: Image, src: Image, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.w) continue;
      const s = (y * src.w + x) * 4;
      const a = src.data[s + 3];
      if (a === 0) continue;
      const d = (ty * dst.w + tx) * 4;
      if (a === 255) {
        dst.data[d] = src.data[s];
        dst.data[d + 1] = src.data[s + 1];
        dst.data[d + 2] = src.data[s + 2];
        dst.data[d + 3] = 255;
      } else {
        const k = a / 255;
        const da = dst.data[d + 3] / 255;
        const oa = k + da * (1 - k);
        for (let c = 0; c < 3; c++) dst.data[d + c] = oa > 0 ? (src.data[s + c] * k + dst.data[d + c] * da * (1 - k)) / oa : 0;
        dst.data[d + 3] = oa * 255;
      }
    }
  }
}
