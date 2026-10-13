// The 24 catalog items as the specs give them (docs/MODULAR-INC1.md, docs/MODULAR-INC2.md §2, §3, §3b, §3c, §4): the
// numbers here are the expectations, written down independently of the game's source on purpose (a test that read
// the prices from the game could not see them change). English names, the language the tests play in.
// Refund: half of each resource, rounded down; a wall's scrap and the sculpture's only as far as storage has room.
export const ITEMS = {
  // Construction (no effect on the economy)
  floor: { cat: 'construction', layer: 'surface', code: 1, name: 'Industrial floor', cost: { credits: 3 }, rots: 1, row: true },
  fence: { cat: 'construction', layer: 'solid', code: 1, name: 'Fence', cost: { credits: 4 }, rots: 2, row: true },
  gate: { cat: 'construction', layer: 'solid', code: 2, name: 'Gate', cost: { credits: 12 }, rots: 2 },
  base: { cat: 'construction', layer: 'surface', code: 2, name: 'Concrete base', cost: { credits: 4 }, rots: 1, row: true },
  wall: { cat: 'construction', layer: 'solid', code: 10, name: 'Low wall', cost: { credits: 2, scrap: 4 }, rots: 2, row: true },
  pillar: { cat: 'construction', layer: 'solid', code: 11, name: 'Corner pillar', cost: { credits: 6 }, rots: 1 },
  // Decorations (no effect on the economy; they move)
  lamp: { cat: 'decorations', layer: 'solid', code: 3, name: 'Lamp post', cost: { credits: 10, parts: 2 }, rots: 4, move: true },
  bench: { cat: 'decorations', layer: 'solid', code: 4, name: 'Bench', cost: { credits: 6 }, rots: 4, move: true },
  planter: { cat: 'decorations', layer: 'solid', code: 5, name: 'Planter', cost: { credits: 5 }, rots: 1, move: true },
  sign: { cat: 'decorations', layer: 'solid', code: 6, name: 'Neon sign', cost: { credits: 15, parts: 4 }, rots: 4, move: true },
  pergola: { cat: 'decorations', layer: 'solid', code: 7, name: 'Pergola', cost: { credits: 12 }, rots: 2, move: true },
  cathouse: { cat: 'decorations', layer: 'solid', code: 8, name: "Miso's house", cost: { credits: 10 }, rots: 4, move: true },
  sculpture: { cat: 'decorations', layer: 'solid', code: 9, name: 'Scrap sculpture', cost: { credits: 10, scrap: 20 }, rots: 4, move: true },
  tree: { cat: 'decorations', layer: 'solid', code: 12, name: 'Tree', cost: { credits: 8 }, rots: 1, move: true },
  fountain: { cat: 'decorations', layer: 'solid', code: 13, name: 'Fountain', cost: { credits: 25, parts: 5 }, rots: 1, move: true },
  statue: { cat: 'decorations', layer: 'solid', code: 14, name: 'Statue of USA-9', cost: { credits: 20, parts: 10 }, rots: 4, move: true },
  // Machine modules (one slot per building; the Recycler's two exclude each other)
  dockStorage: { cat: 'modules', name: 'Extra storage', cost: { credits: 30, parts: 15 }, building: 'dock' },
  smelterFilter: { cat: 'modules', name: 'Smog filter', cost: { credits: 45, parts: 20 }, building: 'smelter' },
  recyclerMagnet: { cat: 'modules', name: 'Magnetic separator', cost: { credits: 40, parts: 15 }, building: 'recycler' },
  recyclerSorter: { cat: 'modules', name: 'Precision sorter', cost: { credits: 40, parts: 15 }, building: 'recycler' },
  factoryArm: { cat: 'modules', name: 'Double arm', cost: { credits: 90, parts: 30 }, building: 'factory' },
  podsCapsule: { cat: 'modules', name: 'Housing capsule', cost: { credits: 35, parts: 15 }, building: 'pods' },
  solarTracker: { cat: 'modules', name: 'Tracking panels', cost: { credits: 60, parts: 40 }, building: 'solar' },
  purifierNozzle: { cat: 'modules', name: 'Extended nozzle', cost: { credits: 50, parts: 30 }, building: 'purifier' },
};
export const KINDS = Object.keys(ITEMS);
export const PIECE_KINDS = KINDS.filter((k) => ITEMS[k].cat !== 'modules');
export const MODULE_KINDS = KINDS.filter((k) => ITEMS[k].cat === 'modules');
export const isModule = (k) => ITEMS[k]?.cat === 'modules';
export const TAG = { construction: 'Construction', decorations: 'Decorations' };

// the 18 projects of increment 2 (docs/MODULAR-INC2.md §4): to discover in a new profile
export const PROJECTS = ['recyclerMagnet', 'bench', 'cathouse', 'planter', 'base', 'tree', 'podsCapsule', 'recyclerSorter', 'purifierNozzle', 'solarTracker', 'sign', 'factoryArm', 'wall', 'pillar', 'pergola', 'sculpture', 'fountain', 'statue'];

export const ZERO = { credits: 0, parts: 0, scrap: 0 };
export const full = (c) => ({ ...ZERO, ...c });
export const neg = (c) => ({ credits: -(c.credits ?? 0), parts: -(c.parts ?? 0), scrap: -(c.scrap ?? 0) });
export const refundOf = (k) => Object.fromEntries(Object.entries(ITEMS[k].cost).map(([r, v]) => [r, Math.floor(v / 2)]));
export const sameCost = (a, b) => ['credits', 'parts', 'scrap'].every((r) => Math.abs((a[r] ?? 0) - (b[r] ?? 0)) < 1e-6);
export const costStr = (c) => ['credits', 'parts', 'scrap'].filter((r) => c[r]).map((r) => `${c[r]} ${r}`).join(' + ') || 'nothing';

// "Remove (+15 credits + 7 parts)" / "+1 credit + 1 scrap" -> { credits, parts, scrap }
export function parseCost(label) {
  const out = { ...ZERO };
  for (const m of String(label ?? '').matchAll(/(\d+)\s+(credits?|parts?|scrap)/g)) out[m[2].startsWith('credit') ? 'credits' : m[2].startsWith('part') ? 'parts' : 'scrap'] += Number(m[1]);
  return out;
}
