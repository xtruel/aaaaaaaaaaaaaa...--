// A build folder served on http://127.0.0.1:<free port>: a stable origin for localStorage (with file:// URLs Chromium
// has been seen to drop a page's storage on reload), one origin per test so that tests never share saves.
// /__blank is an empty page of the same origin: storage is written there BEFORE the game loads (see page.mjs), so
// no marker key is ever left in the game's storage.
import { createServer } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import { extname, join, normalize } from 'path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

export async function serve(dir) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (url === '/__blank') {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      res.end('<!doctype html><meta charset="utf-8"><title>blank</title>');
      return;
    }
    // the browser asks for an icon the single-file build does not have: no 404 in the console
    if (url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const path = normalize(join(dir, url === '/' ? 'index.html' : url));
    if (!path.startsWith(normalize(dir)) || !existsSync(path) || !statSync(path).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(path));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, url: `${base}/index.html`, blank: `${base}/__blank`, close: () => new Promise((r) => server.close(r)) };
}
