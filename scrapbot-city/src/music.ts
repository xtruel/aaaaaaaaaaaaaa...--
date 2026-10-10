// The soundtrack: four short chiptune songs written as 16-step bars and played by a tiny sequencer.
// Lead and bass are note lists, drums are x/. grids. Everything is synthesized, nothing is downloaded.

export type SongId = 'menu' | 'day' | 'night' | 'region';

interface Section {
  chords: string[]; // one chord per bar: C, Am, F#m, Bb...
  lead: string[]; // one bar per string: 16 tokens, a note (E5, F#4, Bb4), '-' to hold, '.' for a rest
  bass: string; // 16 tokens over the bar's chord: R root, 3 third, 5 fifth, o octave, '-' hold, '.' rest
  arp?: string; // same tokens one octave up (t = octave + third, f = octave + fifth)
  kick: string;
  snare: string;
  hat: string;
}

export interface Song {
  bpm: number;
  lead: { wave: 'pulse25' | 'pulse12' | 'triangle'; vol: number; echo: number };
  sections: Section[];
}

const A_FOUR = 'x . . . . . . . x . x . . . . .';
const BACKBEAT = '. . . . x . . . . . . . x . . .';
const EIGHTHS = 'x . x . x . x . x . x . x . x .';

export const SONGS: Record<SongId, Song> = {
  // "Trash Today": the main theme, bright and bouncy (C major, 112 BPM)
  menu: {
    bpm: 112,
    lead: { wave: 'pulse25', vol: 0.11, echo: 0.22 },
    sections: [
      {
        chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
        lead: [
          'E5 . G5 . A5 - G5 . E5 . C5 . D5 - E5 .',
          'D5 - - . B4 . D5 . G5 - - . F5 . E5 .',
          'C5 . E5 . A5 - G5 . E5 . C5 . E5 - D5 .',
          'C5 - - . A4 . C5 . F5 - E5 . D5 . C5 .',
          'E5 . G5 . A5 - G5 . E5 . C5 . D5 - E5 .',
          'D5 - - . B4 . D5 . G5 - A5 . B5 . G5 .',
          'A5 - - . G5 . F5 . E5 - - . D5 . C5 .',
          'D5 - - - - - - . . . G4 . B4 . D5 .',
        ],
        bass: 'R . . R . . R . R . . R . R 5 .',
        kick: A_FOUR,
        snare: BACKBEAT,
        hat: EIGHTHS,
      },
      {
        chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'],
        lead: [
          'A5 - - - G5 - E5 - C5 - - - E5 - - -',
          'F5 - - - E5 - C5 - A4 - - - C5 - - -',
          'G5 - - - E5 - C5 - G4 - - - C5 - E5 -',
          'D5 - - - - - - - B4 - - - G4 - - -',
          'A5 - - - G5 - E5 - C5 - - - E5 - - -',
          'F5 - - - A5 - C6 - A5 - - - F5 - - -',
          'G5 - - - F5 - D5 - B4 - - - D5 - - -',
          'G5 - - - - - - - . . . . D5 . F5 .',
        ],
        bass: 'R - - - 5 - - - R - - - 5 - o -',
        arp: 'R 3 5 o R 3 5 o R 3 5 o R 3 5 o',
        kick: 'x . . . . . . . x . . . . . . .',
        snare: BACKBEAT,
        hat: 'x . . . x . . . x . . . x . . .',
      },
    ],
  },

  // "Rust & Sunshine": daytime building, easy-going (F major, 96 BPM)
  day: {
    bpm: 96,
    lead: { wave: 'pulse25', vol: 0.09, echo: 0.28 },
    sections: [
      {
        chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'],
        lead: [
          'A4 - - . C5 - . . F5 - E5 - C5 - - .',
          'D5 - - . F5 - . . A5 - G5 - F5 - - .',
          'D5 - - . F5 - . . Bb5 - A5 - G5 - - .',
          'E5 - - - - - G5 - - - C5 - - - - .',
          'A4 - - . C5 - . . F5 - E5 - C5 - - .',
          'E5 - - . A5 - . . C6 - - - A5 - - .',
          'Bb5 - A5 - G5 - F5 - D5 - - - F5 - - .',
          'G5 - - - - - - - E5 - - - C5 - - .',
        ],
        bass: 'R - - . 5 - - . R - - . 3 - 5 .',
        kick: 'x . . . . . . . x . . . . . . .',
        snare: BACKBEAT,
        hat: '. . x . . . x . . . x . . . x .',
      },
      {
        chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'C'],
        lead: [
          'F5 . E5 . D5 - - . A4 - - . D5 . F5 .',
          'F5 . E5 . D5 - - . Bb4 - - . D5 . F5 .',
          'A5 - - . G5 . F5 . C5 - - - A4 - - .',
          'G4 - - . C5 . E5 . G5 - - - - - - .',
          'F5 . E5 . D5 - - . A4 - - . D5 . F5 .',
          'F5 . G5 . A5 - - . Bb5 - - . A5 . G5 .',
          'G5 - - . F5 . D5 . Bb4 - - . D5 . G5 .',
          'E5 - - - - - - - G4 . A4 . Bb4 . C5 .',
        ],
        bass: 'R - - . 5 - - . R - - . 3 - 5 .',
        arp: 'R . 5 . o . 5 . R . 5 . o . 5 .',
        kick: 'x . . . . . . . x . . x . . . .',
        snare: BACKBEAT,
        hat: '. . x . . . x . . . x . . . x .',
      },
    ],
  },

  // "Neon Hum": the city at night, slow and dreamy (E minor, 84 BPM)
  night: {
    bpm: 84,
    lead: { wave: 'triangle', vol: 0.2, echo: 0.35 },
    sections: [
      {
        chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B'],
        lead: [
          'B4 - - - - - - - G4 - - - E4 - - -',
          'C5 - - - - - - - G4 - - - E4 - - -',
          'D5 - - - - - B4 - - - G4 - - - - -',
          'F#4 - - - A4 - - - D5 - - - - - - -',
          'G5 - - - F#5 - - - E5 - - - B4 - - -',
          'E5 - - - - - D5 - C5 - - - G4 - - -',
          'A4 - - - C5 - - - E5 - - - A5 - - -',
          'F#5 - - - - - - - D#5 - - - B4 - - -',
        ],
        bass: 'R - - - - - - - 5 - - - - - - -',
        arp: 'R 5 o t o 5 R 5 o t o 5 R 5 o 5',
        kick: 'x . . . . . . . . . . . . . . .',
        snare: '. . . . . . . . . . . . . . . .',
        hat: '. . x . . . x . . . x . . . x .',
      },
      {
        chords: ['Am', 'Em', 'C', 'D', 'Am', 'Em', 'C', 'B'],
        lead: [
          'E5 - - - - - - - C5 - - - A4 - - -',
          'G5 - - - - - - - E5 - - - B4 - - -',
          'G5 - - - E5 - - - C5 - - - E5 - - -',
          'F#5 - - - - - - - A5 - - - - - - -',
          'A5 - - - G5 - - - E5 - - - C5 - - -',
          'B5 - - - - - - - G5 - - - E5 - - -',
          'E5 - - - G5 - - - C6 - - - B5 - - -',
          'B5 - - - - - - - F#5 - - - D#5 - - -',
        ],
        bass: 'R - - - - - - - 5 - - - o - - -',
        arp: 'R 5 o t o 5 R 5 o t o 5 R 5 o 5',
        kick: 'x . . . . . . . x . . . . . . .',
        snare: '. . . . . . . . . . . . . . . .',
        hat: '. . x . . . x . . . x . . . x .',
      },
    ],
  },

  // "Road Trip": the Scrap Coast map, on the move (D major, 124 BPM)
  region: {
    bpm: 124,
    lead: { wave: 'pulse12', vol: 0.12, echo: 0.2 },
    sections: [
      {
        chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'],
        lead: [
          'F#5 . A5 . D6 - A5 . F#5 . D5 . E5 - F#5 .',
          'E5 - - . C#5 . E5 . A5 - - . G5 . F#5 .',
          'D5 . F#5 . B5 - A5 . F#5 . D5 . F#5 - E5 .',
          'D5 - - . B4 . D5 . G5 - F#5 . E5 . D5 .',
          'F#5 . A5 . D6 - A5 . F#5 . D5 . E5 - F#5 .',
          'E5 - - . C#5 . E5 . A5 - B5 . C#6 . A5 .',
          'B5 - - . A5 . G5 . F#5 - - . E5 . D5 .',
          'E5 - - - - - - . . . A4 . C#5 . E5 .',
        ],
        bass: 'R . R . o . R . R . R . o . 5 .',
        kick: 'x . . . x . . . x . . . x . . .',
        snare: '. . . . x . . . . . . . x . . x',
        hat: EIGHTHS,
      },
      {
        chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'],
        lead: [
          'D6 - - - B5 - G5 - D5 - - - G5 - - -',
          'C#6 - - - A5 - E5 - C#5 - - - E5 - - -',
          'A5 - - - F#5 - C#5 - A4 - - - C#5 - - -',
          'B5 - - - F#5 - D5 - B4 - - - D5 - - -',
          'D6 - - - B5 - G5 - D5 - - - G5 - B5 -',
          'C#6 - - - E6 - C#6 - A5 - - - E5 - - -',
          'D6 - - - A5 - F#5 - D5 - - - F#5 - A5 -',
          'D6 - - - - - - - . . . . A5 . C#6 .',
        ],
        bass: 'R . R . o . R . R . R . o . 5 .',
        arp: 'R 3 5 3 R 3 5 3 R 3 5 3 R 3 5 3',
        kick: 'x . . . x . . . x . . . x . . .',
        snare: BACKBEAT,
        hat: EIGHTHS,
      },
    ],
  },
};

// ---------- notation ----------

const NOTE = /^([A-G])([#b]?)(\d)$/;
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteMidi(name: string): number | null {
  const m = NOTE.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function chordOf(name: string): { root: number; minor: boolean } {
  const m = /^([A-G])([#b]?)(m?)$/.exec(name);
  if (!m) return { root: 0, minor: false };
  return { root: (SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, minor: m[3] === 'm' };
}

const INTERVAL: Record<string, (minor: boolean) => number> = {
  R: () => 0,
  '3': (minor) => (minor ? 3 : 4),
  '5': () => 7,
  o: () => 12,
  t: (minor) => (minor ? 15 : 16),
  f: () => 19,
};

export interface NoteEvent {
  step: number; // 0-15 inside the bar
  len: number; // in steps
  midi: number;
}

// Turns a 16-token bar into notes; '-' extends the previous note.
export function parseBar(bar: string, pitch: (token: string) => number | null): NoteEvent[] {
  const tokens = bar.trim().split(/\s+/);
  const out: NoteEvent[] = [];
  tokens.forEach((tok, step) => {
    if (tok === '-') {
      const last = out[out.length - 1];
      if (last && last.step + last.len === step) last.len++;
      return;
    }
    if (tok === '.') return;
    const midi = pitch(tok);
    if (midi !== null) out.push({ step, len: 1, midi });
  });
  return out;
}

export function relativePitch(chord: string, base: number): (token: string) => number | null {
  const c = chordOf(chord);
  return (tok) => (INTERVAL[tok] ? base + c.root + INTERVAL[tok](c.minor) : null);
}

export function hits(grid: string): number[] {
  return grid
    .trim()
    .split(/\s+/)
    .flatMap((tok, i) => (tok === 'x' ? [i] : []));
}
