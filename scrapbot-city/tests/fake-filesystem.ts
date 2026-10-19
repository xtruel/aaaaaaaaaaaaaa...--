// The Filesystem plugin as the iOS app's shell answers it (@capacitor/filesystem 8.1.5 on IONFilesystemLib 2.0.1),
// in memory: a file is written only into a folder that exists, unless the write is recursive; a rename replaces a
// file already at the destination (the destination's folder must exist); reading or listing what is not there fails;
// making a folder that exists fails. Every call is recorded; failWhen makes chosen calls fail; with `slow` every call
// answers a few macrotasks later, as the bridge does, and two calls on the same file at once are reported.
type Options = Record<string, unknown>;

export class FakeFilesystem {
  files = new Map<string, string>(); // 'LIBRARY/saves/x.json' -> text
  dirs = new Set<string>(['LIBRARY', 'DOCUMENTS', 'CACHE']);
  calls: { method: string; options: Options }[] = [];
  failWhen: ((method: string, options: Options) => boolean) | null = null;
  slow = false;
  overlaps: string[] = [];
  private busy = new Set<string>();

  private full(path: unknown, dir: unknown): string {
    return `${String(dir ?? 'DOCUMENTS')}/${String(path).replace(/^\/+|\/+$/g, '')}`;
  }

  private parent(p: string): string {
    return p.slice(0, p.lastIndexOf('/'));
  }

  private mkdirs(p: string): void {
    const parts = p.split('/');
    for (let i = 1; i <= parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
  }

  // the text of a file (path relative to LIBRARY), or undefined
  read(path: string): string | undefined {
    return this.files.get(`LIBRARY/${path}`);
  }

  // what a folder of LIBRARY holds: names of files right in it
  list(path: string): string[] {
    const dir = `LIBRARY/${path}`;
    return [...this.files.keys()].filter((f) => this.parent(f) === dir).map((f) => f.slice(dir.length + 1)).sort();
  }

  call = async (method: string, options: Options): Promise<unknown> => {
    this.calls.push({ method, options });
    const touched = [options.path, options.from, options.to].filter((p) => p !== undefined).map((p) => this.full(p, method === 'rename' && p === options.to ? options.toDirectory ?? options.directory : options.directory));
    for (const t of touched) if (this.busy.has(t)) this.overlaps.push(`${method} ${t}`);
    touched.forEach((t) => this.busy.add(t));
    try {
      if (this.slow) for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
      if (this.failWhen?.(method, options)) throw new Error(`${method} failed (test)`);
      return this.run(method, options);
    } finally {
      touched.forEach((t) => this.busy.delete(t));
    }
  };

  private run(method: string, o: Options): unknown {
    const p = this.full(o.path, o.directory);
    switch (method) {
      case 'readdir': {
        if (!this.dirs.has(p)) throw new Error(`Folder does not exist: ${p}`);
        const files = [...this.files.keys()].filter((f) => this.parent(f) === p).map((f) => ({ name: f.slice(p.length + 1), type: 'file' }));
        const dirs = [...this.dirs].filter((d) => this.parent(d) === p).map((d) => ({ name: d.slice(p.length + 1), type: 'directory' }));
        return { files: [...files, ...dirs] };
      }
      case 'readFile':
        if (!this.files.has(p)) throw new Error(`File does not exist: ${p}`);
        return { data: this.files.get(p) };
      case 'writeFile':
        if (this.dirs.has(p)) throw new Error(`Is a folder: ${p}`);
        if (!this.dirs.has(this.parent(p))) {
          if (!o.recursive) throw new Error(`Parent folder missing: ${p}`);
          this.mkdirs(this.parent(p));
        }
        this.files.set(p, String(o.data));
        return { uri: `file:///${p}` };
      case 'mkdir':
        if (this.dirs.has(p) || this.files.has(p)) throw new Error(`Directory exists: ${p}`);
        if (!this.dirs.has(this.parent(p)) && !o.recursive) throw new Error(`Parent folder missing: ${p}`);
        this.mkdirs(p);
        return undefined;
      case 'rename': {
        const from = this.full(o.from, o.directory);
        const to = this.full(o.to, o.toDirectory ?? o.directory);
        if (!this.files.has(from)) throw new Error(`File does not exist: ${from}`);
        if (!this.dirs.has(this.parent(to))) throw new Error(`Parent folder missing: ${to}`);
        if (from === to) return undefined;
        this.files.set(to, this.files.get(from)!);
        this.files.delete(from);
        return undefined;
      }
      default:
        // deleteFile, rmdir, copy...: the mirror never needs them
        throw new Error(`not in the fake: ${method}`);
    }
  }
}
