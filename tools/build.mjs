#!/usr/bin/env node
// Builds content/ from a source folder: shrinks each photo, then encrypts photos + text with the start code.
// Usage: node tools/build.mjs photos-src      (or demo-src for placeholders)
// The source folder holds content.json and the photos it names; it is gitignored and never published.
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ITER = 600_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(process.argv[2] || 'photos-src');
const out = join(root, 'content');
const cfg = JSON.parse(readFileSync(join(src, 'content.json'), 'utf8'));

const code = String(cfg.code).replace(/\D/g, '');
const slots = cfg.codeFormat.replace(/[^A-Z]/gi, '').length;
if (code.length !== slots) throw new Error(`code "${cfg.code}" has ${code.length} digits but codeFormat "${cfg.codeFormat}" needs ${slots}`);

const salt = randomBytes(16);
const key = pbkdf2Sync(code, salt, ITER, 32, 'sha256');
const seal = buf => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  return Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]);
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
const tmp = mkdtempSync(join(tmpdir(), 'dolma-'));
const done = new Map();

// Drop APP1 (EXIF/XMP: GPS location, camera, timestamps) and APP13 (IPTC) segments from a JPEG.
// APP2 stays so the iPhone's Display P3 color profile survives.
function stripMeta(buf) {
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    if (marker === 0xda) { parts.push(buf.subarray(i)); break; } // start of scan: rest is image data
    const len = buf.readUInt16BE(i + 2);
    if (marker !== 0xe1 && marker !== 0xed) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(parts);
}

// EXIF orientation → clockwise degrees, applied to the pixels since the EXIF tag gets stripped
const ROTATE = { 3: 180, 6: 90, 8: 270 };
function orientation(file) {
  const m = execFileSync('sips', ['-g', 'orientation', file], { encoding: 'utf8' }).match(/orientation:\s*(\d)/);
  return m ? Number(m[1]) : 1;
}

// Photo filename → { id, type }; the same file used twice is stored once
function photo(name) {
  if (!name) return undefined;
  if (done.has(name)) return done.get(name);
  const file = join(src, name);
  const id = `p${done.size}`;
  let bytes, type;
  if (extname(name).toLowerCase() === '.svg') {
    bytes = readFileSync(file);
    type = 'image/svg+xml';
  } else {
    // sips is built into macOS: handles HEIC, resizes to 1400px on the long edge, re-encodes as JPEG
    const jpg = join(tmp, `${id}.jpg`);
    const turn = ROTATE[orientation(file)];
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1400', ...(turn ? ['-r', String(turn)] : []), file, '--out', jpg], { stdio: 'ignore' });
    bytes = stripMeta(readFileSync(jpg));
    type = 'image/jpeg';
  }
  writeFileSync(join(out, `${id}.bin`), seal(bytes));
  const ref = { id, type };
  done.set(name, ref);
  return ref;
}

const withPhoto = it => ({ ...it, photo: photo(it.photo) });
const manifest = {
  player: cfg.player,
  memory: cfg.memory.map(withPhoto),
  puzzle: withPhoto(cfg.puzzle),
  quiz: cfg.quiz.map(withPhoto),
  scratch: cfg.scratch.map(withPhoto),
  letter: cfg.letter,
};
writeFileSync(join(out, 'manifest.bin'), seal(Buffer.from(JSON.stringify(manifest))));
writeFileSync(join(out, 'meta.json'), JSON.stringify({ salt: salt.toString('base64'), iter: ITER, format: cfg.codeFormat }));
rmSync(tmp, { recursive: true, force: true });

console.log(`content/ built: ${done.size} photos, ${cfg.memory.length} pairs, ${cfg.quiz.length} questions, ${cfg.scratch.length} scratch cards`);
