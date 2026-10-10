// Citizens (walk the streets, more of them as the city grows) and Miso the cat.
// Models face +y (south-west on screen), like the bots; the build rotates them for the other three directions.
import { M } from '../palette';
import { Vox, hex, mat } from '../voxel';

// ---------- extra colours (skin, hair, shoes, cat fur) ----------
const SKIN_L = mat('characters-skin-light', { rgb: hex('#f6c9a2'), jitter: 0 });
const SKIN_T = mat('characters-skin-tan', { rgb: hex('#d39466'), jitter: 0 });
const SKIN_D = mat('characters-skin-dark', { rgb: hex('#8f5a3a'), jitter: 0 });
const HAIR_BROWN = mat('characters-hair-brown', { rgb: hex('#6a3b22'), jitter: 0.03 });
const HAIR_DARK = mat('characters-hair-dark', { rgb: hex('#3a2a2a'), jitter: 0.03 });
const SHOE = mat('characters-shoe', { rgb: hex('#5a3a28'), jitter: 0 });
const DENIM = mat('characters-denim', { rgb: hex('#3d5fa8'), jitter: 0.02 });
// Miso's fur: black, with a dark-purple sheen on top and a lighter purple-grey chest so she reads on dark ground
const FUR_TOP = mat('characters-cat-sheen', { rgb: hex('#3a2f5e'), jitter: 0 });
const FUR_BELLY = mat('characters-cat-belly', { rgb: hex('#5b4c86'), jitter: 0 });
const NOSE = mat('characters-cat-nose', { rgb: hex('#ff8fb8'), jitter: 0 });

// ---------- citizens ----------

type Hat = 'cap' | 'spiky' | 'short' | 'hardhat' | 'messy' | 'bun';

interface Look {
  skin: number;
  hair: number;
  hat: Hat;
  hatColor?: number;
  shirt: number;
  sleeve: number; // sleeves (and collar)
  print?: number; // a 2×2 print on the chest
  pants: number;
  shoes: number;
}

// The six people of the NPC row in the asset sheet.
const LOOKS: Look[] = [
  // grey cap with a yellow badge, teal shirt with a yellow print
  { skin: SKIN_L, hair: HAIR_BROWN, hat: 'cap', hatColor: M.steelL, shirt: M.cyanD, sleeve: M.sky, print: M.yellow, pants: M.navy, shoes: SHOE },
  // spiky blue hair, light-blue shirt over a white tee
  { skin: SKIN_L, hair: M.blue, hat: 'spiky', shirt: M.sky, sleeve: M.white, pants: M.blueD, shoes: M.ink },
  // short brown hair, white shirt with a sky-blue vest
  { skin: SKIN_T, hair: HAIR_BROWN, hat: 'short', shirt: M.sky, sleeve: M.white, pants: M.navy, shoes: SHOE },
  // yellow hard hat, dark-purple work shirt with a red badge, grey sleeves
  { skin: SKIN_T, hair: HAIR_DARK, hat: 'hardhat', hatColor: M.yellow, shirt: M.purpleD, sleeve: M.steelL, print: M.red, pants: M.dark, shoes: SHOE },
  // messy green hair, black tee with a yellow emblem
  { skin: SKIN_D, hair: M.green, hat: 'messy', shirt: M.darkL, sleeve: M.darkL, print: M.yellow, pants: M.navy, shoes: M.ink },
  // pink hair in a bun, light-blue blouse with a white collar, jeans
  { skin: SKIN_L, hair: M.pink, hat: 'bun', shirt: M.sky, sleeve: M.white, pants: DENIM, shoes: M.pinkD },
];

export const CITIZEN_VARIANTS = LOOKS.length;
export const CITIZEN_FRAMES = 2;

// A chibi citizen, 6×6 voxels wide and 14-15 tall: big head (6×5×6) with hair or a hat, a small body, short legs.
// frame 0/1 = the two walking steps (legs and arms swap).
export function citizenModel(variant: number, frame: number): Vox {
  const L = LOOKS[((variant % LOOKS.length) + LOOKS.length) % LOOKS.length];
  const v = new Vox(6, 6, 15);
  const step = frame % 2;
  // legs: one planted forward (+y), the other back and lifted off the ground; shoes at the bottom
  for (const [x0, left] of [
    [1, true],
    [3, false],
  ] as const) {
    const fwd = left === (step === 0);
    const y0 = fwd ? 2 : 1;
    const z0 = fwd ? 0 : 1;
    v.box(x0, y0, z0, x0 + 2, y0 + 2, 3, L.pants);
    v.box(x0, y0, z0, x0 + 2, y0 + 2, z0 + 1, L.shoes);
  }
  // hips and body
  v.box(1, 1, 3, 5, 4, 4, L.pants);
  v.box(1, 1, 4, 5, 4, 7, L.shirt);
  // collar / undershirt line at the neck on the front
  v.box(2, 3, 6, 4, 4, 7, L.sleeve);
  if (L.print) v.box(2, 3, 4, 4, 4, 6, L.print);
  // arms swing opposite to the legs: sleeve on top, hand below
  for (const [x, left] of [
    [0, true],
    [5, false],
  ] as const) {
    const y = left === (step === 0) ? 1 : 3;
    v.box(x, y, 5, x + 1, y + 1, 7, L.sleeve);
    v.box(x, y, 4, x + 1, y + 1, 5, L.skin);
  }
  // head
  v.box(0, 0, 7, 6, 5, 13, L.skin);
  // eyes (2 tall) and a small mouth
  v.box(1, 4, 8, 2, 5, 10, M.ink);
  v.box(4, 4, 8, 5, 5, 10, M.ink);
  // hair: back, sides and top, with a fringe over the forehead
  const hair = (m: number) => {
    v.box(0, 0, 7, 6, 2, 13, m); // back of the head
    v.box(0, 0, 10, 1, 5, 13, m); // sides above the ears
    v.box(5, 0, 10, 6, 5, 13, m);
    v.box(0, 0, 12, 6, 5, 13, m); // top
    v.box(0, 4, 11, 6, 5, 12, m); // fringe
  };
  switch (L.hat) {
    case 'cap': {
      hair(L.hair);
      const c = L.hatColor ?? M.steelL;
      v.box(0, 0, 12, 6, 5, 14, c);
      v.box(1, 5, 12, 5, 6, 13, M.steel); // brim
      v.box(2, 4, 13, 4, 5, 14, M.yellow); // badge
      break;
    }
    case 'hardhat': {
      hair(L.hair);
      const c = L.hatColor ?? M.yellow;
      v.box(0, 0, 12, 6, 6, 13, c); // wide brim all round the front
      v.box(1, 0, 13, 5, 5, 14, c);
      v.box(2, 1, 14, 4, 4, 15, c); // crown ridge
      v.box(1, 4, 12, 5, 6, 13, M.orange); // darker brim front edge
      break;
    }
    case 'spiky':
      hair(L.hair);
      // three 2×2 tufts sticking up
      v.box(0, 1, 13, 2, 3, 14, L.hair);
      v.box(2, 0, 13, 4, 2, 15, L.hair);
      v.box(4, 2, 13, 6, 4, 14, L.hair);
      v.box(2, 3, 13, 4, 5, 14, L.hair);
      break;
    case 'short':
      hair(L.hair);
      v.box(1, 0, 13, 5, 4, 14, L.hair);
      v.clear(3, 4, 11, 6, 5, 12); // side parting: the fringe only on one side
      v.box(3, 4, 11, 6, 5, 12, L.skin);
      break;
    case 'messy':
      hair(L.hair);
      v.box(0, 0, 13, 3, 3, 14, L.hair);
      v.box(3, 1, 13, 6, 5, 14, L.hair);
      v.box(0, 4, 10, 2, 5, 11, L.hair); // a lock falling to one side of the face
      break;
    case 'bun':
      hair(L.hair);
      v.box(0, 0, 13, 6, 4, 14, L.hair);
      v.box(2, 0, 14, 4, 2, 15, L.hair); // the bun on top at the back
      // long hair down the back and the sides
      v.box(0, 0, 7, 6, 1, 13, L.hair);
      v.box(0, 0, 8, 1, 3, 13, L.hair);
      v.box(5, 0, 8, 6, 3, 13, L.hair);
      break;
  }
  // blush-pink cheeks under the eyes for the bun girl, a mouth for everyone
  v.box(2, 4, 7, 4, 5, 8, L.hat === 'bun' ? M.pink : L.skin === SKIN_D ? HAIR_DARK : M.rustD);
  return v;
}

// ---------- Miso the cat ----------

export type CatPose = 'sit' | 'walk';
export const CAT_FRAMES = 2;

// Miso: a small black cat with a red collar, lime eyes and pointy ears, 8×8 voxels and 10 tall, facing +y.
// Few, bold colours so she reads at a few pixels: black fur with a dark-purple sheen on top, a lighter chest and
// muzzle, two separate ear spikes, a red collar. sit: frame 0/1 = the tail tip flicks and an ear twitches. walk:
// frame 0/1 = the two steps (diagonal leg pairs swap) and the tail sways.
export function catModel(pose: CatPose, frame: number): Vox {
  const v = new Vox(8, 8, 10);
  const f = frame % 2;
  // head 4 wide, 4 deep, 3 tall with its face on the +y side at y1 - 1
  const head = (z: number, y1: number, flick = false) => {
    v.box(2, y1 - 4, z, 6, y1, z + 3, M.ink);
    v.box(2, y1 - 4, z + 2, 6, y1, z + 3, FUR_TOP);
    v.box(2, y1 - 1, z + 1, 3, y1, z + 2, M.limeLit);
    v.box(5, y1 - 1, z + 1, 6, y1, z + 2, M.limeLit);
    v.box(3, y1 - 1, z, 5, y1, z + 1, FUR_BELLY); // muzzle
    v.set(3, y1 - 1, z + 1, NOSE);
    // pointy ears: two spikes on the outer corners, 2 tall; a flicked ear folds out sideways
    v.box(5, y1 - 3, z + 3, 6, y1 - 2, z + 5, FUR_TOP);
    if (flick) v.box(1, y1 - 3, z + 2, 3, y1 - 2, z + 4, FUR_TOP);
    else v.box(2, y1 - 3, z + 3, 3, y1 - 2, z + 5, FUR_TOP);
  };
  if (pose === 'sit') {
    v.box(2, 1, 0, 6, 5, 3, M.ink); // haunches
    v.box(2, 1, 2, 6, 5, 3, FUR_TOP);
    v.box(2, 3, 0, 6, 6, 5, M.ink); // upright chest
    v.box(3, 5, 1, 5, 6, 4, FUR_BELLY);
    v.box(2, 6, 0, 6, 7, 1, M.ink); // front paws
    v.set(2, 6, 0, FUR_BELLY);
    v.set(5, 6, 0, FUR_BELLY);
    v.box(2, 3, 4, 6, 6, 5, M.red); // collar
    head(5, 7, f === 1);
    // tail curled round the right side on the ground; the tip flicks up (and an ear twitches)
    v.box(6, 1, 0, 7, 6, 1, M.ink);
    if (f === 0) v.box(6, 5, 0, 7, 7, 1, FUR_TOP);
    else v.box(6, 6, 0, 7, 7, 3, FUR_TOP);
  } else {
    v.box(2, 1, 2, 6, 6, 5, M.ink); // body, low and long
    v.box(2, 1, 4, 6, 6, 5, FUR_TOP);
    // legs: diagonal pairs step forward and back
    const legs: [number, number][] =
      f === 0
        ? [
            [2, 5],
            [5, 4],
            [2, 1],
            [5, 2],
          ]
        : [
            [2, 4],
            [5, 5],
            [2, 2],
            [5, 1],
          ];
    for (const [x, y] of legs) {
      v.box(x, y, 0, x + 1, y + 1, 2, M.ink);
      v.set(x, y, 0, FUR_BELLY);
    }
    v.box(2, 5, 2, 6, 6, 4, FUR_BELLY); // chest
    v.box(2, 5, 4, 6, 6, 5, M.red); // collar
    head(5, 8);
    // tail rising from the back, the tip sways left and right
    v.box(3, 0, 3, 5, 1, 6, M.ink);
    v.box(f === 0 ? 2 : 4, 0, 6, f === 0 ? 4 : 6, 1, 8, M.ink);
    v.box(f === 0 ? 2 : 4, 0, 7, f === 0 ? 4 : 6, 1, 8, FUR_TOP);
  }
  return v;
}
