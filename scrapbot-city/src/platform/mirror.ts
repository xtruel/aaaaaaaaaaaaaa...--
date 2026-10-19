// The iOS app's copy of the saves in files. iOS may clear a web view's website data (localStorage) on its own, and
// every city with it: src/storage.ts tells the mirror of each write and removal the browser storage took, and the
// mirror writes that key to Library/saves/<name>.json (a temporary file first, then a rename over the old one), with a
// write sequence number. A removal is written as a file that says so, so a restart of a city never comes back.
// At launch, before the game reads anything, restore() puts back what the browser storage lost:
//  - a key missing there comes back from its file (unless the browser removed it after the file was written);
//  - a key both hold with different texts keeps the newer by the sequence numbers (the browser storage keeps its own
//    under STATE_KEY; one it has no number for is taken as the newer: it is the copy the game was using);
//  - whatever is about to be replaced is first copied to Library/saves/aside/ (a copy that cannot be written leaves
//    both as they are); a file that cannot be read is moved there, never deleted. Nothing here ever deletes a file.
// Only src/platform/native.ts makes one, in the iOS app: nothing of this runs on the web or on the desktop.

// The Filesystem plugin's calls as the shell's bridge takes them (@capacitor/filesystem: method name and options).
export type FsCall = (method: 'readdir' | 'readFile' | 'writeFile' | 'rename' | 'mkdir', options: Record<string, unknown>) => Promise<unknown>;

export const DIRECTORY = 'LIBRARY';
export const FOLDER = 'saves';
export const ASIDE = `${FOLDER}/aside`;
// the browser storage's side: { v: 1, next, seq: { key: sequence number of its last write or removal } }
export const STATE_KEY = 'scrapbot.mirror';

interface Envelope {
  scrapbot: 'save-mirror';
  v: 1;
  key: string;
  seq: number;
  at: number;
  value?: string;
  removed?: true;
}

interface Found {
  file: string;
  tmp: boolean;
  text: string;
  env: Envelope;
}

export interface RestoreReport {
  restored: string[]; // missing in the browser storage: put back from the file
  replaced: string[]; // the file was newer: the browser's text copied aside, then replaced (or removed)
  kept: string[]; // the browser's text was newer, or had no file: kept, the file (if any) copied aside and rewritten
  damaged: string[]; // files that could not be read: moved to saves/aside
  failed: string[]; // could not be done: left as it was
}

// One file name per key, with letters, digits and '-' only (iOS and the Mac read ':' and '%' in a path differently):
// any other character is _ and two hex digits, or __ and six above U+00FF.
export function fileName(key: string): string {
  let out = '';
  for (const ch of key) {
    const c = ch.codePointAt(0)!;
    if (/[a-z0-9-]/.test(ch)) out += ch;
    else out += c < 0x100 ? `_${c.toString(16).padStart(2, '0')}` : `__${c.toString(16).padStart(6, '0')}`;
  }
  return out;
}

// The key a file name stands for, or null for a name fileName never makes.
export function keyOf(name: string): string | null {
  let out = '';
  for (let i = 0; i < name.length; ) {
    const ch = name[i];
    if (/[a-z0-9-]/.test(ch)) {
      out += ch;
      i++;
      continue;
    }
    if (ch !== '_') return null;
    const wide = name[i + 1] === '_';
    const hex = wide ? name.slice(i + 2, i + 8) : name.slice(i + 1, i + 3);
    if (!/^[0-9a-f]+$/.test(hex) || hex.length !== (wide ? 6 : 2)) return null;
    out += String.fromCodePoint(parseInt(hex, 16));
    i += wide ? 8 : 3;
  }
  return out || null;
}

export function parseEnvelope(text: string): Envelope | null {
  try {
    const e = JSON.parse(text) as Partial<Envelope> | null;
    if (!e || e.scrapbot !== 'save-mirror' || e.v !== 1 || typeof e.key !== 'string' || !Number.isSafeInteger(e.seq) || (e.seq as number) <= 0) return null;
    if (e.removed === true ? e.value !== undefined : typeof e.value !== 'string') return null;
    return e as Envelope;
  } catch {
    return null;
  }
}

type Job = { seq: number; value: string | null }; // value null: removed

export class SaveMirror {
  private fs: FsCall;
  private storage: Storage;
  private prefix: string;
  private now: () => number;
  private next = 1;
  private seqs: Record<string, number> = {};
  private waiting = new Map<string, Job>();
  private writing = new Set<string>();
  private failed = new Map<string, Job>();
  private idle: (() => void)[] = [];
  private stamp = 0;
  // restore gave up (it took too long): it changes nothing more, no file is written; sequence numbers are still kept
  private off = false;

  constructor(fs: FsCall, storage: Storage, prefix: string, now: () => number = Date.now) {
    this.fs = fs;
    this.storage = storage;
    this.prefix = prefix;
    this.now = now;
    this.loadState();
  }

  // ---------- writes (src/storage.ts) ----------

  write(key: string, value: string): void {
    this.enqueue(key, value);
  }

  remove(key: string): void {
    this.enqueue(key, null);
  }

  // Every write asked for so far is in its file (or failed again): writes that failed are tried once more.
  flush(): Promise<void> {
    for (const [key, job] of this.failed) if (!this.waiting.has(key)) this.waiting.set(key, job);
    this.failed.clear();
    for (const key of [...this.waiting.keys()]) this.pump(key);
    if (!this.busy()) return Promise.resolve();
    return new Promise((resolve) => this.idle.push(resolve));
  }

  // The keys whose last write could not be put in its file (tried again by the next flush).
  failedKeys(): string[] {
    return [...this.failed.keys()];
  }

  // Restore took too long: the game starts without it. From now on nothing here touches the browser storage's keys
  // or the files; the sequence numbers of the game's writes are still kept, so the next launch knows they are newer.
  abandon(): void {
    this.off = true;
    this.waiting.clear();
    this.failed.clear();
  }

  // A number above every one given before (on this side or in a file): the clock's milliseconds, or one more.
  private nextSeq(): number {
    const seq = Math.max(this.next, Math.floor(this.now()));
    this.next = seq + 1;
    return seq;
  }

  private enqueue(key: string, value: string | null): void {
    try {
      const seq = this.nextSeq();
      this.seqs[key] = seq;
      this.saveState();
      if (this.off) return;
      this.failed.delete(key);
      this.waiting.set(key, { seq, value });
      this.pump(key);
    } catch {
      // never in the way of a save in the browser storage
    }
  }

  private busy(): boolean {
    return this.writing.size > 0 || this.waiting.size > 0;
  }

  // One write at a time per key (they share the temporary file), all keys at once.
  private pump(key: string): void {
    if (this.writing.has(key)) return;
    const job = this.waiting.get(key);
    if (!job) return;
    this.waiting.delete(key);
    this.writing.add(key);
    void this.store(key, job).then((ok) => {
      this.writing.delete(key);
      if (!ok && !this.waiting.has(key) && !this.off) this.failed.set(key, job);
      if (this.waiting.has(key)) this.pump(key);
      else if (!this.busy()) for (const done of this.idle.splice(0)) done();
    });
  }

  private async store(key: string, job: Job): Promise<boolean> {
    const name = fileName(key);
    const env: Envelope = { scrapbot: 'save-mirror', v: 1, key, seq: job.seq, at: Date.now(), ...(job.value === null ? { removed: true as const } : { value: job.value }) };
    try {
      await this.fs('writeFile', { path: `${FOLDER}/${name}.json.tmp`, directory: DIRECTORY, encoding: 'utf8', recursive: true, data: JSON.stringify(env) });
      await this.fs('rename', { from: `${FOLDER}/${name}.json.tmp`, to: `${FOLDER}/${name}.json`, directory: DIRECTORY, toDirectory: DIRECTORY });
      return true;
    } catch {
      return false;
    }
  }

  // ---------- the browser storage's side ----------

  private loadState(): void {
    try {
      const st = JSON.parse(this.storage.getItem(STATE_KEY) ?? 'null') as { next?: unknown; seq?: unknown } | null;
      if (st?.seq && typeof st.seq === 'object') {
        for (const [k, v] of Object.entries(st.seq as Record<string, unknown>)) if (Number.isSafeInteger(v) && (v as number) > 0) this.seqs[k] = v as number;
      }
      if (Number.isSafeInteger(st?.next)) this.next = Math.max(this.next, st!.next as number);
    } catch {
      // unreadable: this side has no sequence numbers
    }
  }

  private saveState(): void {
    try {
      this.storage.setItem(STATE_KEY, JSON.stringify({ v: 1, next: this.next, seq: this.seqs }));
    } catch {
      // storage full or blocked: the numbers are kept in memory
    }
  }

  private localKeys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const k = this.storage.key(i);
        if (k?.startsWith(this.prefix)) keys.push(k.slice(this.prefix.length));
      }
    } catch {
      // storage blocked: nothing on this side
    }
    return keys;
  }

  // ---------- launch ----------

  async restore(): Promise<RestoreReport> {
    const report: RestoreReport = { restored: [], replaced: [], kept: [], damaged: [], failed: [] };
    const found = new Map<string, Found[]>();
    let names: string[] = [];
    try {
      const r = (await this.fs('readdir', { path: FOLDER, directory: DIRECTORY })) as { files?: (string | { name?: string; type?: string })[] };
      names = (r?.files ?? []).filter((f) => typeof f === 'string' || f.type !== 'directory').map((f) => (typeof f === 'string' ? f : f.name ?? ''));
    } catch {
      // no folder yet (first launch): nothing to put back
    }
    for (const file of names.sort()) {
      const m = /^([a-z0-9_-]+)\.json(\.tmp)?$/.exec(file);
      const key = m ? keyOf(m[1]) : null;
      if (!m || key === null) continue; // not one of ours: left alone
      let text: string | null = null;
      try {
        text = ((await this.fs('readFile', { path: `${FOLDER}/${file}`, directory: DIRECTORY, encoding: 'utf8' })) as { data?: unknown })?.data as string;
      } catch {
        text = null;
      }
      const env = typeof text === 'string' ? parseEnvelope(text) : null;
      if (!env || env.key !== key) {
        if (this.off) break;
        report.damaged.push(file);
        if (!(await this.moveAside(file, 'damaged'))) report.failed.push(file);
        continue;
      }
      const list = found.get(key) ?? [];
      list.push({ file, tmp: !!m[2], text: text!, env });
      found.set(key, list);
      this.next = Math.max(this.next, env.seq + 1);
    }
    for (const seq of Object.values(this.seqs)) this.next = Math.max(this.next, seq + 1);

    const rewrite: [string, string | null][] = [];
    for (const key of [...new Set([...found.keys(), ...this.localKeys()])].sort()) {
      if (this.off) break;
      let local: string | null = null;
      try {
        local = this.storage.getItem(this.prefix + key);
      } catch {
        local = null;
      }
      const lseq = this.seqs[key];
      // the file's newest version (the main file over a temporary one of the same number)
      const best = (found.get(key) ?? []).reduce<Found | null>((a, b) => (!a || b.env.seq > a.env.seq || (b.env.seq === a.env.seq && !b.tmp) ? b : a), null);
      if (!best) {
        if (local !== null) {
          report.kept.push(key);
          rewrite.push([key, local]);
        }
        continue;
      }
      const theirs = best.env.removed ? null : (best.env.value as string);
      if (theirs === local) {
        this.seqs[key] = Math.max(lseq ?? 0, best.env.seq);
        if (best.tmp) rewrite.push([key, local]);
        continue;
      }
      // the file is newer when this side has a lower number for the key (none: this side is taken as the newer)
      const fileNewer = lseq !== undefined && best.env.seq > lseq;
      if (local === null && lseq !== undefined && lseq > best.env.seq) {
        // removed here after the file was written: it stays removed; the file's text is copied aside first
        if (theirs !== null && !(await this.copyAside(best, 'file'))) {
          report.failed.push(key);
          continue;
        }
        report.kept.push(key);
        rewrite.push([key, null]);
        continue;
      }
      if (local === null || fileNewer) {
        // missing here, or older here: the file's version comes in; a text here is copied aside first
        if (local !== null && !(await this.writeAside(key, local, lseq ?? 0))) {
          report.failed.push(key);
          continue;
        }
        if (this.off) break;
        try {
          if (theirs === null) this.storage.removeItem(this.prefix + key);
          else this.storage.setItem(this.prefix + key, theirs);
        } catch {
          report.failed.push(key);
          continue;
        }
        this.seqs[key] = best.env.seq;
        (local === null ? report.restored : report.replaced).push(key);
        if (best.tmp) rewrite.push([key, theirs]);
        continue;
      }
      // newer here (or here without a number): the file's version is copied aside, then the file follows this side
      if (theirs !== null && !(await this.copyAside(best, 'file'))) {
        report.failed.push(key);
        continue;
      }
      report.kept.push(key);
      rewrite.push([key, local]);
    }
    if (this.off) return report;
    this.saveState();
    for (const [key, value] of rewrite) this.enqueue(key, value);
    return report;
  }

  private asideName(file: string, kind: string, seq: number): string {
    const base = file.replace(/\.json(\.tmp)?$/, '');
    return `${ASIDE}/${base}.${kind}-${seq}-${Math.floor(this.now())}-${++this.stamp}.json`;
  }

  // A file's version kept aside (its own text), before the file is written over.
  private async copyAside(f: Found, kind: string): Promise<boolean> {
    if (this.off) return false;
    try {
      await this.fs('writeFile', { path: this.asideName(f.file, kind, f.env.seq), directory: DIRECTORY, encoding: 'utf8', recursive: true, data: f.text });
      return true;
    } catch {
      return false;
    }
  }

  // The browser storage's text kept aside, as a file of the same form, before it is replaced.
  private async writeAside(key: string, value: string, seq: number): Promise<boolean> {
    if (this.off) return false;
    const env: Envelope = { scrapbot: 'save-mirror', v: 1, key, seq: Math.max(1, seq), at: Date.now(), value };
    try {
      await this.fs('writeFile', { path: this.asideName(fileName(key), 'local', seq), directory: DIRECTORY, encoding: 'utf8', recursive: true, data: JSON.stringify(env) });
      return true;
    } catch {
      return false;
    }
  }

  // A file that cannot be read goes aside as it is (moved, not copied: it is not tried again at every launch).
  private async moveAside(file: string, kind: string): Promise<boolean> {
    if (this.off) return false;
    try {
      await this.fs('mkdir', { path: ASIDE, directory: DIRECTORY, recursive: true });
    } catch {
      // there already
    }
    try {
      await this.fs('rename', { from: `${FOLDER}/${file}`, to: this.asideName(file, kind, 0), directory: DIRECTORY, toDirectory: DIRECTORY });
      return true;
    } catch {
      return false;
    }
  }
}
