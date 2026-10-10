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
// Miso's fur: near-black body (lighter than the renderer's ink outline so her shape survives), a purple sheen on
// her upper half, the 2D Miso rim colour on the very top layer (head, back, ear tips) and a light lilac chest, so
// she reads on asphalt, pave and industrial ground.
const FUR = mat('characters-cat-fur', { rgb: hex('#241c38'), jitter: 0 });
const FUR_TOP = mat('characters-cat-sheen', { rgb: hex('#5e4f9c'), jitter: 0 });
const FUR_RIM = mat('characters-cat-rim', { rgb: hex('#8d82c8'), jitter: 0 });
const FUR_BELLY = mat('characters-cat-belly', { rgb: hex('#8a7cc0'), jitter: 0 });
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

// The six people of the NPC row in the asset sheet, with clearly different torsos (and legs that stay lighter than
// the asphalt) so a crowd reads as six people at 1x.
const LOOKS: Look[] = [
  // grey cap with a yellow badge, teal shirt with a yellow print, jeans
  { skin: SKIN_L, hair: HAIR_BROWN, hat: 'cap', hatColor: M.steelL, shirt: M.cyanD, sleeve: M.sky, print: M.yellow, pants: DENIM, shoes: SHOE },
  // spiky blue hair, dark-blue jacket with sky sleeves over a white tee
  { skin: SKIN_L, hair: M.blue, hat: 'spiky', shirt: M.blueD, sleeve: M.sky, print: M.white, pants: M.steel, shoes: SHOE },
  // short brown hair, white tee with a red logo
  { skin: SKIN_T, hair: HAIR_BROWN, hat: 'short', shirt: M.white, sleeve: M.white, print: M.red, pants: M.steelD, shoes: SHOE },
  // yellow hard hat, orange hi-vis shirt with a reflective yellow patch, grey sleeves and work trousers
  { skin: SKIN_T, hair: HAIR_DARK, hat: 'hardhat', hatColor: M.yellow, shirt: M.orange, sleeve: M.steelL, print: M.yellow, pants: M.steelD, shoes: SHOE },
  // messy green hair, steel-grey tee with a lime emblem, light sneakers
  { skin: SKIN_D, hair: M.green, hat: 'messy', shirt: M.steel, sleeve: M.steel, print: M.lime, pants: M.navy, shoes: M.white },
  // pink hair in a bun, light-blue blouse with a white collar, jeans
  { skin: SKIN_L, hair: M.pink, hat: 'bun', shirt: M.sky, sleeve: M.white, pants: DENIM, shoes: M.pinkD },
];

export const CITIZEN_VARIANTS = LOOKS.length;
export const CITIZEN_FRAMES = 2;

// A chibi citizen, 6×6 voxels wide and 13-14 tall (about a door's height): big head (6×5×6) with hair or a hat,
// a 3-row body, short legs. frame 0/1 = the two walking steps (legs and arms swap).
export function citizenModel(variant: number, frame: number): Vox {
  const L = LOOKS[((variant % LOOKS.length) + LOOKS.length) % LOOKS.length];
  const v = new Vox(6, 6, 14);
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
  // body: three rows of shirt
  v.box(1, 1, 3, 5, 4, 6, L.shirt);
  // collar / undershirt line at the neck on the front, and the chest print below it
  v.box(2, 3, 5, 4, 4, 6, L.sleeve);
  if (L.print) v.box(2, 3, 3, 4, 4, 5, L.print);
  // arms swing opposite to the legs: sleeve on top, hand below
  for (const [x, left] of [
    [0, true],
    [5, false],
  ] as const) {
    const y = left === (step === 0) ? 1 : 3;
    v.box(x, y, 4, x + 1, y + 1, 6, L.sleeve);
    v.box(x, y, 3, x + 1, y + 1, 4, L.skin);
  }
  // head
  v.box(0, 0, 6, 6, 5, 12, L.skin);
  // eyes (2 tall)
  v.box(1, 4, 7, 2, 5, 9, M.ink);
  v.box(4, 4, 7, 5, 5, 9, M.ink);
  // hair: back, sides and top, with a fringe over the forehead
  const hair = (m: number) => {
    v.box(0, 0, 6, 6, 2, 12, m); // back of the head
    v.box(0, 0, 9, 1, 5, 12, m); // sides above the ears
    v.box(5, 0, 9, 6, 5, 12, m);
    v.box(0, 0, 11, 6, 5, 12, m); // top
    v.box(0, 4, 10, 6, 5, 11, m); // fringe
  };
  switch (L.hat) {
    case 'cap': {
      hair(L.hair);
      const c = L.hatColor ?? M.steelL;
      v.box(0, 0, 11, 6, 5, 13, c);
      v.box(1, 5, 11, 5, 6, 12, M.steel); // brim
      v.box(2, 4, 12, 4, 5, 13, M.yellow); // badge
      break;
    }
    case 'hardhat': {
      hair(L.hair);
      const c = L.hatColor ?? M.yellow;
      v.box(0, 0, 11, 6, 6, 12, c); // wide brim all round the front
      v.box(1, 0, 12, 5, 5, 13, c);
      v.box(2, 1, 13, 4, 4, 14, c); // crown ridge
      v.box(1, 5, 11, 5, 6, 12, M.orange); // darker brim front edge
      break;
    }
    case 'spiky':
      hair(L.hair);
      // 2×2 tufts sticking up
      v.box(0, 1, 12, 2, 3, 13, L.hair);
      v.box(2, 0, 12, 4, 2, 14, L.hair);
      v.box(4, 2, 12, 6, 4, 13, L.hair);
      v.box(2, 3, 12, 4, 5, 13, L.hair);
      break;
    case 'short':
      hair(L.hair);
      v.box(1, 0, 12, 5, 4, 13, L.hair);
      v.box(3, 4, 10, 6, 5, 11, L.skin); // side parting: the fringe only on one side
      break;
    case 'messy':
      hair(L.hair);
      v.box(0, 0, 12, 3, 3, 13, L.hair);
      v.box(3, 1, 12, 6, 5, 13, L.hair);
      v.box(0, 4, 9, 2, 5, 10, L.hair); // a lock falling to one side of the face
      break;
    case 'bun':
      hair(L.hair);
      v.box(0, 0, 12, 6, 4, 13, L.hair);
      v.box(2, 0, 13, 4, 2, 14, L.hair); // the bun on top at the back
      // long hair down the back and the sides
      v.box(0, 0, 6, 6, 1, 12, L.hair);
      v.box(0, 0, 7, 1, 3, 12, L.hair);
      v.box(5, 0, 7, 6, 3, 12, L.hair);
      break;
  }
  // blush-pink cheeks under the eyes for the bun girl, a mouth for everyone
  v.box(2, 4, 6, 4, 5, 7, L.hat === 'bun' ? M.pink : L.skin === SKIN_D ? HAIR_DARK : M.rustD);
  return v;
}

// ---------- Miso the cat ----------

export type CatPose = 'sit' | 'walk';
export const CAT_FRAMES = 2;

// Miso: a small black cat with a red collar, lime eyes and pointy ears, 8×8 voxels and 9 tall, facing +y.
// Few, bold colours so she reads at a few pixels: near-black fur with a purple sheen and a light rim on top, a
// lilac chest and muzzle, two ear spikes, a red collar. sit: an upright tail at the back; frame 0/1 = the tail tip
// hooks over and an ear twitches. walk: frame 0/1 = the two steps (diagonal leg pairs swap) and the tail sways.
export function catModel(pose: CatPose, frame: number): Vox {
  const v = new Vox(8, 8, 9);
  const f = frame % 2;
  // head 4 wide, 4 deep, 3 tall with its face on the +y side at y1 - 1; ears on top (z+3..z+5)
  const head = (z: number, y1: number, flick = false) => {
    v.box(2, y1 - 4, z, 6, y1, z + 3, FUR);
    v.box(2, y1 - 4, z + 2, 6, y1, z + 3, FUR_RIM); // light top of the head
    v.box(2, y1 - 1, z + 1, 3, y1, z + 2, M.limeLit);
    v.box(5, y1 - 1, z + 1, 6, y1, z + 2, M.limeLit);
    v.box(3, y1 - 1, z, 5, y1, z + 1, FUR_BELLY); // muzzle
    v.set(3, y1 - 1, z + 1, NOSE);
    // pointy ears: two spikes on the outer corners, 2 tall with a light tip; a flicked ear folds out sideways
    v.box(5, y1 - 3, z + 3, 6, y1 - 2, z + 4, FUR_TOP);
    v.box(5, y1 - 3, z + 4, 6, y1 - 2, z + 5, FUR_RIM);
    if (flick) {
      v.box(1, y1 - 3, z + 2, 2, y1 - 2, z + 3, FUR_TOP);
      v.box(0, y1 - 3, z + 3, 2, y1 - 2, z + 4, FUR_RIM);
    } else {
      v.box(2, y1 - 3, z + 3, 3, y1 - 2, z + 4, FUR_TOP);
      v.box(2, y1 - 3, z + 4, 3, y1 - 2, z + 5, FUR_RIM);
    }
  };
  if (pose === 'sit') {
    v.box(2, 1, 0, 6, 5, 3, FUR); // haunches
    v.box(2, 1, 2, 6, 3, 3, FUR_TOP); // back top
    v.box(2, 3, 0, 6, 6, 4, FUR); // upright chest
    v.box(2, 3, 2, 6, 6, 3, FUR_TOP);
    v.box(3, 5, 0, 5, 6, 3, FUR_BELLY);
    v.box(2, 6, 0, 6, 7, 1, FUR); // front paws
    v.set(2, 6, 0, FUR_BELLY);
    v.set(5, 6, 0, FUR_BELLY);
    v.box(2, 3, 3, 6, 6, 4, M.red); // collar
    head(4, 7, f === 1);
    // tail standing up at the back-right, rising above the head's right side; on the second frame its tip hooks
    // over the back like a question mark
    v.box(6, 1, 0, 7, 3, 2, FUR); // base curled on the ground
    if (f === 0) {
      v.box(6, 1, 2, 7, 2, 8, FUR);
      v.box(6, 1, 5, 7, 2, 8, FUR_TOP);
      v.box(6, 1, 8, 7, 2, 9, FUR_RIM);
    } else {
      v.box(6, 1, 2, 7, 2, 8, FUR);
      v.box(6, 1, 5, 7, 2, 8, FUR_TOP);
      v.box(4, 1, 8, 7, 2, 9, FUR_RIM);
      v.box(4, 1, 7, 5, 2, 8, FUR_TOP);
    }
  } else {
    v.box(2, 1, 2, 6, 6, 5, FUR); // body, low and long
    v.box(2, 1, 3, 6, 6, 4, FUR_TOP);
    v.box(2, 1, 4, 6, 6, 5, FUR_RIM); // back top
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
      v.box(x, y, 0, x + 1, y + 1, 2, FUR);
      v.set(x, y, 0, FUR_BELLY);
    }
    v.box(2, 5, 2, 6, 6, 3, FUR_BELLY); // chest
    v.box(2, 5, 3, 6, 6, 4, M.red); // collar
    head(4, 8);
    // tail rising from the back, the tip sways left and right
    v.box(3, 0, 3, 5, 1, 6, FUR);
    v.box(f === 0 ? 1 : 5, 0, 5, f === 0 ? 3 : 7, 1, 8, FUR);
    v.box(f === 0 ? 1 : 5, 0, 7, f === 0 ? 3 : 7, 1, 8, FUR_RIM);
  }
  return v;
}
