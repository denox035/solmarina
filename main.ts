// main.ts — the entrypoint for the SOLMARINA gta6-01 entry (Node 22+, stdlib
// only). It copies game/ and screenshots/ from beside this file to /output
// and writes /output/dossier.json with the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is not shippable without its game and its screenshots: fail
// loudly instead of handing in an empty output directory.
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
const shotNames = ['1-drive.jpg', '2-chase.jpg', '3-mission.jpg', '4-combat.jpg'];
for (const name of shotNames) {
  if (!existsSync(join(shotsDir, name))) throw new Error(`screenshots/${name} is missing`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// Read-back: the dossier must parse and carry the expected schema, and the
// file on disk must be exactly what buildDossier returned.
writeFileSync(join(out, 'dossier.json'), dossier);
const back = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
if (back.schema !== 'makefun/dossier/v1') throw new Error('dossier schema mismatch: ' + back.schema);
console.log(`dossier.json written: ${dossier.length} bytes`);
