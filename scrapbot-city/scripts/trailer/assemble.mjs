// Trailer step 3: node scripts/trailer/assemble.mjs --in <record dir> --out <trailer.mp4> [--crf 14] [--max 60]
//
// Turns the clips kept by record.mjs into one video in the format Steam asks for (partner.steamgames.com/doc/store/
// trailer, read 2026-10-11): 1920x1080, 16:9, 30 fps, H.264 + AAC 48 kHz in .mp4, high bit rate (5,000+ kbit/s).
// Hard cuts between the clips, a 0.5 s fade from and to black at the two ends, nothing else: no text, no logo, no
// effects, no speed changes. The audio track is silent (the recording has no sound): music must be added
// separately (see README.md). Also writes <out>.contact.jpg (one frame every 2 s, for review) and
// <out>.thumbnail.jpg (a 1920x1080 frame of the video, usable as Steam's custom thumbnail, which must be a frame).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const argv = process.argv.slice(2);
const opt = (name, def) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
const dir = path.resolve(opt('--in', 'trailer-out'));
const outFile = path.resolve(opt('--out', path.join(dir, 'trailer.mp4')));
const crf = opt('--crf', '14');
const maxSeconds = Number(opt('--max', '60'));
const FPS = 30;
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'scenes.json'), 'utf8'));
const [W, H] = meta.size.split('x').map(Number);
const work = path.join(dir, 'encode');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const probe = (file, entries) =>
  execFileSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim();

// Longer than --max: the watching clips (cities, region, night, smog, menus) lose the end of their footage, evenly,
// never below 2.4 s; the action clips (build, decorate, module, event) are never cut.
const ACTION = new Set(['build', 'decorate', 'module', 'event']);
let over = meta.keep.reduce((n, k) => n + (k.end - k.start), 0) - maxSeconds;
for (let pass = 0; over > 0.01 && pass < 20; pass++) {
  const cuttable = meta.keep.filter((k) => !ACTION.has(k.name) && k.end - k.start > 2.4);
  if (!cuttable.length) break;
  const each = over / cuttable.length;
  for (const k of cuttable) {
    const cut = Math.min(each, k.end - k.start - 2.4);
    k.end -= cut;
    over -= cut;
    if (k.frames) k.frames = k.frames.filter((f) => f.t <= k.end);
  }
}
if (over > 0.01) console.warn(`assemble: still ${over.toFixed(1)} s over --max ${maxSeconds}`);

// every clip at 30 fps, same size and codec settings, so they can be joined without another encode
const VIDEO = ['-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const scale = `scale=${1920}:${1080}:flags=neighbor,setsar=1`;
const parts = [];
for (const [i, k] of meta.keep.entries()) {
  const part = path.join(work, `${String(i + 1).padStart(2, '0')}-${k.name}.mp4`);
  if (meta.capture === 'screencast') {
    if (!k.frames?.length) {
      console.warn(`assemble: clip ${k.name} has no frames, skipped`);
      continue;
    }
    // concat list: each frame shown until the next one arrived (the page only sends a frame when it changed)
    const lines = ['ffconcat version 1.0'];
    k.frames.forEach((f, j) => {
      const next = j + 1 < k.frames.length ? k.frames[j + 1].t : k.end;
      lines.push(`file '${path.join(dir, k.dir, f.file)}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    lines.push(`file '${path.join(dir, k.dir, k.frames.at(-1).file)}'`);
    const list = path.join(work, `${i + 1}.ffconcat`);
    fs.writeFileSync(list, lines.join('\n') + '\n');
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `${scale},fps=${FPS}`, '-t', (k.end - k.start).toFixed(3), ...VIDEO, '-an', part]);
  } else {
    ff(['-ss', k.start.toFixed(3), '-to', k.end.toFixed(3), '-i', path.join(dir, meta.raw), '-vf', `${scale},fps=${FPS}`, ...VIDEO, '-an', part]);
  }
  parts.push({ name: k.name, file: part, seconds: Number(probe(part, 'format=duration')) });
}
if (!parts.length) throw new Error('assemble: nothing to assemble');

// join, fade the two ends, add a silent stereo AAC track
const joinList = path.join(work, 'join.ffconcat');
fs.writeFileSync(joinList, ['ffconcat version 1.0', ...parts.map((p) => `file '${p.file}'`)].join('\n') + '\n');
const joined = path.join(work, 'joined.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', joinList, '-c', 'copy', joined]);
const total = Number(probe(joined, 'format=duration'));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
ff([
  '-i', joined,
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-vf', `fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.5).toFixed(3)}:d=0.5`,
  ...VIDEO,
  '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart',
  outFile,
]);

// review sheet and thumbnail
ff(['-i', outFile, '-vf', `fps=1/2,scale=480:-1,tile=4x${Math.ceil(total / 2 / 4)}`, '-frames:v', '1', '-q:v', '3', `${outFile}.contact.jpg`]);
const night = parts.findIndex((p) => p.name === 'night');
const at = night >= 0 ? parts.slice(0, night).reduce((n, p) => n + p.seconds, 0) + parts[night].seconds / 2 : total / 2;
ff(['-ss', at.toFixed(2), '-i', outFile, '-frames:v', '1', '-q:v', '2', `${outFile}.thumbnail.jpg`]);

const info = {
  file: outFile,
  seconds: Number(probe(outFile, 'format=duration')),
  bitrateKbps: Math.round(Number(probe(outFile, 'format=bit_rate')) / 1000),
  video: probe(outFile, 'stream=codec_name,width,height,r_frame_rate').split('\n').join(' '),
  clips: parts.map((p) => `${p.name} ${p.seconds.toFixed(2)} s`),
  source: { build: meta.build, buildSha256: meta.buildSha256, capture: meta.capture, recordedSize: `${W}x${H}` },
};
fs.writeFileSync(`${outFile}.json`, JSON.stringify(info, null, 2));
console.log(`assemble: ${outFile} — ${info.seconds.toFixed(1)} s, ${info.bitrateKbps} kbit/s, ${info.video}`);
console.log(`  ${info.clips.join(' | ')}`);
