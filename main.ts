// SOLMARINA — make.fun gta6-01 entry program (round 5, fresh in-session build).
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Node 22, standard library only, no network.
// Run locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(import.meta.dirname);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Fail fast on a bad tree instead of handing the grader a half entry.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('SOLMARINA: game/index.html is missing');
}
const shotFiles = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error('SOLMARINA: screenshots/ must hold 3 or 4 images, found ' + shotFiles.length);
}
for (const f of shotFiles) {
  if (statSync(join(shotsDir, f)).size > 262144) {
    throw new Error('SOLMARINA: screenshot ' + f + ' is over the 256 KiB cap');
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
// Read back what was written: the grader requires the dossier to equal
// what buildDossier writes, so confirm the bytes on disk match.
const written = readFileSync(join(outDir, 'dossier.json'));
if (!written.equals(dossier)) {
  throw new Error('SOLMARINA: dossier.json on disk does not match the built bytes');
}
const digest = createHash('sha256').update(written).digest('hex').slice(0, 16);
console.log('SOLMARINA dossier written: ' + dossier.length + ' bytes, sha256 ' + digest + '… -> ' + join(outDir, 'dossier.json'));
