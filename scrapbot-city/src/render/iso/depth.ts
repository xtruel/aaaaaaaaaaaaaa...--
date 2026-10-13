// Draw order for isometric objects of different sizes.
//
// Sorting by x + y fails when footprints differ (a 3×3 building next to a 1×1 garden). Instead, for every
// pair whose screen rectangles overlap, the one that is separated "behind" the other on some axis is drawn
// first (view direction (1, 1, 1): bigger x, y or z is nearer), then a topological sort gives the order.
// Everything is preallocated and reused, so a frame allocates nothing.

export interface DepthItem {
  // world box (x0 < x1, y0 < y1, z0 < z1)
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  // screen rectangle in iso pixels
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  // payload
  kind: number;
  ref: number;
  // scratch
  mark: number;
}

function blank(): DepthItem {
  return { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, sx0: 0, sy0: 0, sx1: 0, sy1: 0, kind: 0, ref: 0, mark: 0 };
}

// 1 = a before b, -1 = b before a, 0 = no constraint
// Does a building with the footprint `b` stand in front of the ground area `a` (both in world or tile units, x0 < x1,
// y0 < y1), hiding it where they overlap on screen? The area lies behind the building on an axis, and the building
// does not lie behind the area. The renderer draws such a building see-through over a spot being built on or
// bulldozed, and a click can reach what it hides (src/ui/pick.ts).
export function standsInFront(b: { x0: number; y0: number; x1: number; y1: number }, a: { x0: number; y0: number; x1: number; y1: number }): boolean {
  const areaBehind = a.x1 <= b.x0 || a.y1 <= b.y0;
  const buildingBehind = b.x1 <= a.x0 || b.y1 <= a.y0;
  return areaBehind && !buildingBehind;
}

export function compareDepth(a: DepthItem, b: DepthItem): number {
  const ab = a.x1 <= b.x0 || a.y1 <= b.y0 || a.z1 <= b.z0;
  const ba = b.x1 <= a.x0 || b.y1 <= a.y0 || b.z1 <= a.z0;
  if (ab && !ba) return 1;
  if (ba && !ab) return -1;
  if (ab && ba) return 0; // separated in opposite directions: they cannot cover each other
  // intersecting boxes (a bot passing through a roof edge): nearest centre last
  const ca = a.x0 + a.x1 + a.y0 + a.y1 + a.z0 + a.z1;
  const cb = b.x0 + b.x1 + b.y0 + b.y1 + b.z0 + b.z1;
  return ca <= cb ? 1 : -1;
}

export class DepthSorter {
  private pool: DepthItem[] = [];
  private n = 0;
  private byX: number[] = [];
  private ea = new Int32Array(1024); // edge: ea[k] must be drawn before eb[k]
  private eb = new Int32Array(1024);
  private edgeCount = 0;
  private start = new Int32Array(64);
  private adj = new Int32Array(1024);
  private stack = new Int32Array(64);
  private iter = new Int32Array(64);

  begin(): void {
    this.n = 0;
  }

  get count(): number {
    return this.n;
  }

  add(): DepthItem {
    if (this.n >= this.pool.length) this.pool.push(blank());
    const it = this.pool[this.n++];
    it.mark = 0;
    return it;
  }

  private edge(a: number, b: number): void {
    if (this.edgeCount >= this.ea.length) {
      const na = new Int32Array(this.ea.length * 2);
      const nb = new Int32Array(this.eb.length * 2);
      na.set(this.ea);
      nb.set(this.eb);
      this.ea = na;
      this.eb = nb;
    }
    this.ea[this.edgeCount] = a;
    this.eb[this.edgeCount] = b;
    this.edgeCount++;
  }

  // Fills `out` with the items in drawing order (back to front) and returns their count.
  sort(out: DepthItem[]): number {
    const n = this.n;
    const items = this.pool;
    const byX = this.byX;
    byX.length = n;
    for (let i = 0; i < n; i++) byX[i] = i;
    byX.sort((a, b) => items[a].sx0 - items[b].sx0);
    this.edgeCount = 0;
    for (let p = 0; p < n; p++) {
      const a = items[byX[p]];
      for (let q = p + 1; q < n; q++) {
        const b = items[byX[q]];
        if (b.sx0 >= a.sx1) break;
        if (b.sy0 >= a.sy1 || a.sy0 >= b.sy1) continue;
        const c = compareDepth(a, b);
        if (c > 0) this.edge(byX[p], byX[q]);
        else if (c < 0) this.edge(byX[q], byX[p]);
      }
    }
    // adjacency: for each item, the items that must be drawn before it
    if (this.start.length < n + 1) {
      this.start = new Int32Array((n + 1) * 2);
      this.stack = new Int32Array((n + 1) * 2);
      this.iter = new Int32Array((n + 1) * 2);
    }
    if (this.adj.length < this.edgeCount) this.adj = new Int32Array(this.edgeCount * 2);
    const start = this.start;
    start.fill(0, 0, n + 1);
    for (let k = 0; k < this.edgeCount; k++) start[this.eb[k] + 1]++;
    for (let i = 0; i < n; i++) start[i + 1] += start[i];
    const fill = this.iter;
    for (let i = 0; i < n; i++) fill[i] = start[i];
    for (let k = 0; k < this.edgeCount; k++) this.adj[fill[this.eb[k]]++] = this.ea[k];
    // depth-first: emit an item after everything behind it (a cycle is broken where it is found)
    let o = 0;
    const stack = this.stack;
    const iter = this.iter;
    for (let p = 0; p < n; p++) {
      const root = byX[p];
      if (items[root].mark) continue;
      let sp = 0;
      stack[sp] = root;
      iter[sp] = start[root];
      items[root].mark = 1;
      while (sp >= 0) {
        const v = stack[sp];
        if (iter[sp] < start[v + 1]) {
          const w = this.adj[iter[sp]++];
          if (!items[w].mark) {
            items[w].mark = 1;
            sp++;
            stack[sp] = w;
            iter[sp] = start[w];
          }
        } else {
          items[v].mark = 2;
          out[o++] = items[v];
          sp--;
        }
      }
    }
    return o;
  }
}
