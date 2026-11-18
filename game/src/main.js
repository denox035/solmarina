// main.js — SOLMARINA boot, game loop, state machine, input, save, scene staging.
// ?scene=drive|chase|mission|combat (or legacy ?shot=start|play|end) stages a scene
// and sets window.__shotReady once painted, for screenshots.
import { buildCity, mulberry32 } from './city.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, tryStealCar, nearestStealableCar } from './player.js';
import { spawnParkedCars, spawnTraffic, updateVehicles, makeCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { updatePolice } from './police.js';
import { fireWeapon, updateBullets, updateEnemies, spawnPickups, updatePickups, makeEnemy } from './combat.js';
import { MISSIONS, startMission, updateMissions, updateTailCar } from './missions.js';
import { render } from './render.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene') || params.get('shot') || '';
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

export function createGame() {
  const rnd = mulberry32(20261118);
  const city = buildCity(20261118);
  const G = {
    canvas, ctx, city, rnd,
    time: 0, state: 'title', zoom: 1,
    keys: {}, mouse: { x: 0, y: 0, worldX: 0, worldY: 0, active: false, down: false },
    player: createPlayer(city.landmarks.hideout.x + 40, city.landmarks.hideout.y + 60),
    cars: [], peds: [], cops: [], bullets: [], enemies: [], pickups: [],
    floaters: [], wanted: 0, wantedTimer: 0, lastCrimeAt: -100,
    missionIdx: 0, mission: null, completedMissions: [], missionFailedIdx: -1,
    nextMissionAt: 0, objectiveHint: null, msg: '', msgT: 0,
    shake: 0, cam: null, stealTarget: null,
    audio: createAudio(), saveExists: hasSave(),
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, deaths: 0, playSeconds: 0, shotsFiredAt: -100 },
  };
  spawnParkedCars(G, 26);
  spawnTraffic(G, 16);
  spawnPeds(G, 26);
  spawnPickups(G);
  return G;
}

let G = createGame();
window.__game = G; // handy for debugging / playtests

function resetGame(keepSave = false) {
  const fresh = createGame();
  if (keepSave) { /* fresh state, save stays on disk */ }
  G = fresh;
  window.__game = G;
}

function applySave(d) {
  G.player.cash = d.cash; G.player.hp = d.hp;
  G.player.x = d.x; G.player.y = d.y;
  G.missionIdx = d.missionIdx; G.completedMissions = d.completed || [];
  G.wanted = d.wanted || 0;
  G.stats.kills = d.kills || 0; G.stats.carsStolen = d.carsStolen || 0;
  G.stats.missionsDone = d.missionsDone || 0; G.stats.playSeconds = d.playSeconds || 0;
  if (G.missionIdx < MISSIONS.length) G.nextMissionAt = G.time + 1;
}

function startPlaying(fromSave) {
  if (fromSave) {
    const d = loadGame();
    if (d) applySave(d);
  }
  G.state = 'play';
  G.audio.ensure();
  G.msg = fromSave ? 'Welcome back to Solmarina.' : 'Welcome to Solmarina. Press M to take your first job from Rico.';
  G.msgT = 5;
}

// ---- staged scenes for screenshots (real gameplay, just pre-positioned) ----
function stageScene(name) {
  G.state = 'play';
  G.audio.ensure();
  if (name === 'start') { G.state = 'title'; return; }
  if (name === 'drive' || name === 'play') {
    // Player driving down Sol Blvd with traffic around.
    const car = makeCar(1700, 1400, 0, { color: '#d84a4a', name: 'Comet' });
    car.player = true; G.player.inCar = car; car.speed = 220;
    G.cars.push(car);
    G.player.x = car.x; G.player.y = car.y;
    startMission(G, 0);
    G.msg = 'SOLMARINA — steal cars, run jobs, outrun the PD.';
    G.msgT = 6;
  } else if (name === 'chase') {
    const car = makeCar(1700, 1700, 0, { color: '#4a7ad8', name: 'Viento' });
    car.player = true; G.player.inCar = car; car.speed = 300;
    G.cars.push(car);
    G.player.x = car.x; G.player.y = car.y;
    G.wanted = 3; G.wantedTimer = 0;
    startMission(G, 4);
    G.msg = '3 STARS — the whole PD is on you!';
    G.msgT = 6;
  } else if (name === 'mission') {
    startMission(G, 1);
    const car = makeCar(2300, 1700, Math.PI / 2, { color: '#e8c84a', name: 'Marlin' });
    car.player = true; G.player.inCar = car; car.speed = 180;
    G.cars.push(car);
    G.player.x = car.x; G.player.y = car.y;
    G.msg = 'JOB 2 — Salt in the Wound: reach the marina docks.';
    G.msgT = 6;
  } else if (name === 'combat') {
    G.player.x = 2900; G.player.y = 1500;
    G.player.weapon = 'pistol'; G.player.ammo = 48;
    G.player.angle = 0;
    for (let i = 0; i < 4; i++) {
      G.enemies.push(makeEnemy(G, 3050 + i * 40, 1420 + (i % 2) * 120, { hp: 70, aggro: true }));
    }
    startMission(G, 3);
    G.wanted = 2;
    G.msg = 'Banco del Sol crew — Coral Kings at the marina!';
    G.msgT = 6;
  }
}

// ---- input ----
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  G.keys[e.code] = true;
  G.audio.ensure();
  if (G.state === 'title') {
    if (e.code === 'Enter') startPlaying(G.saveExists);
    if (e.code === 'KeyN') { clearSave(); G.saveExists = false; startPlaying(false); }
    return;
  }
  if (G.state === 'dead' || G.state === 'win') {
    if (e.code === 'Enter') { resetGame(); startPlaying(false); }
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    G.state = G.state === 'play' ? 'pause' : G.state === 'pause' ? 'play' : G.state;
  }
  if (G.state !== 'play') return;
  if (e.code === 'KeyE') tryStealCar(G);
  if (e.code === 'KeyF') fireWeapon(G);
  if (e.code === 'KeyM') {
    if (!G.mission && G.missionIdx < MISSIONS.length) startMission(G, G.missionIdx);
    else if (G.mission) G.msg = `${G.mission.def.name}: ${G.mission.def.brief}`;
    G.msgT = 6;
  }
  if (e.code === 'KeyS' && G.state === 'pause') { /* S handled below in pause */ }
  if (e.code === 'KeyR') { resetGame(); startPlaying(false); }
  if (e.code === 'KeyM' && e.shiftKey) { /* no-op */ }
  if (e.code === 'KeyX') G.audio.toggleMute();
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => {
  G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.active = true;
  const cam = G.cam;
  if (cam) {
    G.mouse.worldX = cam.x + e.clientX / cam.zoom;
    G.mouse.worldY = cam.y + e.clientY / cam.zoom;
  }
});
canvas.addEventListener('mousedown', (e) => {
  G.audio.ensure();
  if (G.state !== 'play') return;
  G.mouse.down = true;
  fireWeapon(G);
});
canvas.addEventListener('mouseup', () => { G.mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Pause-screen save: S while paused.
window.addEventListener('keydown', (e) => {
  if (G.state === 'pause' && e.code === 'KeyS') {
    saveGame(G);
    G.msg = 'Game saved.';
    G.msgT = 3;
  }
});

// ---- update ----
function update(dt) {
  G.time += dt;
  G.stats.playSeconds += dt;
  if (G.msgT > 0) G.msgT -= dt;
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.t += dt;
    if (f.t > 1.6) G.floaters.splice(i, 1);
  }
  G.stealTarget = G.player.inCar ? null : nearestStealableCar(G);
  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updateTailCar(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateEnemies(G, dt);
  updatePickups(G, dt);
  updateMissions(G, dt);
  // Vault cash pickup (mission 4): walking over it grabs the loot.
  if (G.mission && G.mission.def.id === 4 && G.mission.stage === 1 && !G.mission.cashGrabbed) {
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const pk = G.pickups[i];
      if (pk.kind === 'vaultcash' && Math.hypot(pk.x - G.player.x, pk.y - G.player.y) < 34 && !G.player.inCar) {
        G.pickups.splice(i, 1);
        G.mission.cashGrabbed = true;
        G.audio.cash();
        G.msg = 'Cash grabbed! RUN — every cop in the city is coming!';
        G.msgT = 5;
      }
    }
  }
  // Autosave every 60s of play.
  if (Math.floor(G.stats.playSeconds) % 60 === 0 && G.stats.playSeconds > 1 && !G._savedAtSec) {
    G._savedAtSec = Math.floor(G.stats.playSeconds);
    saveGame(G);
  }
  if (Math.floor(G.stats.playSeconds) % 60 !== 0) G._savedAtSec = 0;
  // Engine sound idles down on foot.
  if (!G.player.inCar) G.audio.setEngine(0, false);
}

// ---- main loop ----
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (G.state === 'play') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) { update(STEP); acc -= STEP; steps++; }
    if (steps === 5) acc = 0;
  }
  render(G);
}

// Boot: stage a scene if requested, else title screen.
if (scene) {
  stageScene(scene);
  // Let the world settle for a second, then flag readiness for the screenshot.
  let settled = 0;
  const settle = setInterval(() => {
    for (let i = 0; i < 10; i++) update(STEP);
    render(G);
    settled++;
    if (settled >= 6) {
      clearInterval(settle);
      window.__shotReady = true;
    }
  }, 100);
} else {
  window.__shotReady = true;
}
requestAnimationFrame(frame);
