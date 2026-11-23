// Porto Verde — a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html, its ES modules and vendored three.js), and this
// program hands it in. It copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// Serve it locally with a static server, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countGameFiles(dir, rel = '') {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const r = rel ? rel + '/' + name : name;
    const st = statSync(p);
    if (st.isDirectory()) {
      const sub = countGameFiles(p, r);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
      if (Buffer.byteLength(r, 'utf8') > LIMITS.game_path_max_bytes) {
        throw new Error('game path too long: ' + r);
      }
    }
  }
  return { files, bytes };
}

const gameDir = join(here, 'game');
const shotDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
if (!existsSync(shotDir)) throw new Error('screenshots/ is missing');

const gameStats = countGameFiles(gameDir);
if (gameStats.files > LIMITS.game_max_files) {
  throw new Error(`game/ has ${gameStats.files} files, over the ${LIMITS.game_max_files} cap`);
}
if (gameStats.bytes > LIMITS.game_max_bytes) {
  throw new Error(`game/ is ${gameStats.bytes} bytes, over the ${LIMITS.game_max_bytes} cap`);
}
const shotNames = readdirSync(shotDir).filter((n) => !n.startsWith('.')).sort();
if (shotNames.length < 3 || shotNames.length > LIMITS.screenshots.max) {
  throw new Error(`screenshots/ holds ${shotNames.length} images, need 3 or 4`);
}
for (const name of shotNames) {
  const st = statSync(join(shotDir, name));
  if (!st.isFile()) throw new Error('screenshots/' + name + ' is not a file');
  if (st.size > LIMITS.screenshots.max_bytes) {
    throw new Error(`screenshots/${name} is ${st.size} bytes, over the 256 KiB cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, LIMITS));

// Post-write verification: the entry is only as good as the bytes the grader
// will read, so re-read what was just written and fail loudly instead of
// handing in a corrupt dossier. This runs on every invocation, both of the
// grader's two runs, so a mismatch fails the run rather than the entry.
const dossierRaw = readFileSync(join(out, 'dossier.json'), 'utf8');
if (dossierRaw.length > 1572864) {
  throw new Error(`dossier.json is ${dossierRaw.length} bytes, over the 1.5 MiB cap`);
}
const dossier = JSON.parse(dossierRaw);
if (typeof dossier !== 'object' || dossier === null || typeof dossier.text !== 'string') {
  throw new Error('dossier.json did not parse into the expected shape');
}
if (!dossier.text.includes('game/index.html')) {
  throw new Error('dossier.json text does not contain game/index.html');
}
const outShots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.')).sort();
if (outShots.join(',') !== shotNames.join(',')) {
  throw new Error('screenshots copied to /output do not match screenshots/ in the repo');
}
for (const name of outShots) {
  const srcSize = statSync(join(shotDir, name)).size;
  const outSize = statSync(join(out, 'screenshots', name)).size;
  if (srcSize !== outSize) throw new Error(`screenshots/${name} changed size while copying`);
}
const indexSize = statSync(join(out, 'game', 'index.html')).size;
if (indexSize > 1048576) throw new Error(`game/index.html is ${indexSize} bytes, over the 1 MiB cap`);

