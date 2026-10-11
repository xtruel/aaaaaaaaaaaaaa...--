// Isometric projection shared by the renderer, the input code and the tests.
//
// World: x, y in world units (one tile = TILE = 16), z = height in the same unit.
// Iso art pixels (before zoom):   isoX = x − y,   isoY = (x + y) / 2 − z
// A tile is a 32×16 diamond whose top vertex is the projection of its (tx, ty) corner.
import { TILE } from '../../game/defs';

export const TILE_W = TILE * 2; // 32 px
export const TILE_H = TILE; // 16 px

export function isoX(x: number, y: number): number {
  return x - y;
}

export function isoY(x: number, y: number, z = 0): number {
  return (x + y) / 2 - z;
}

// Ground point (z = 0) under an iso pixel position.
export function groundAt(X: number, Y: number): { x: number; y: number } {
  return { x: Y + X / 2, y: Y - X / 2 };
}

// The tile whose diamond contains the iso point (X, Y) on the ground.
export function tileAt(X: number, Y: number): { x: number; y: number } {
  const g = groundAt(X, Y);
  return { x: Math.floor(g.x / TILE), y: Math.floor(g.y / TILE) };
}

// Iso position of a tile's top vertex (its back corner).
export function tileTop(tx: number, ty: number): { X: number; Y: number } {
  return { X: (tx - ty) * TILE, Y: ((tx + ty) * TILE) / 2 };
}

// Iso position of a tile's centre on the ground.
export function tileCenter(tx: number, ty: number): { X: number; Y: number } {
  return { X: (tx - ty) * TILE, Y: ((tx + ty + 1) * TILE) / 2 };
}

// Rows of a tile diamond for crisp fills: row r (0..15) spans [16 − half, 16 + half) from the tile's left edge.
export function diamondHalfWidth(row: number): number {
  return 2 * Math.min(row, TILE_H - 1 - row) + 1;
}

// A ground circle of `radius` world units around (cx, cy), as the iso view shows it: an ellipse centred on the
// circle's centre, twice as wide as it is tall (the Purifier's reach). `dashes`: the iso pixel of every dot of a
// dashed outline at angle offset `spin`, one dot every 2 px or so along the ellipse, 3 dots on and 2 off.
export function groundRing(cx: number, cy: number, radius: number, spin = 0): { X: number; Y: number; ax: number; ay: number; dashes: { X: number; Y: number }[] } {
  const X = isoX(cx, cy);
  const Y = isoY(cx, cy);
  const ax = radius * Math.SQRT2;
  const ay = ax / 2;
  const around = Math.PI * (3 * (ax + ay) - Math.sqrt((3 * ax + ay) * (ax + 3 * ay)));
  const steps = Math.max(40, Math.round(around / 2 / 5) * 5);
  const dashes: { X: number; Y: number }[] = [];
  for (let k = 0; k < steps; k++) {
    if (k % 5 >= 3) continue;
    const a = (k / steps) * Math.PI * 2 + spin;
    dashes.push({ X: Math.round(X + Math.cos(a) * ax), Y: Math.round(Y + Math.sin(a) * ay) });
  }
  return { X, Y, ax, ay, dashes };
}
