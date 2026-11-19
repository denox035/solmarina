// main.js — Solmarina boot, input, camera, the game loop and staging scenes.
// The game is a top-down open world: Mara Voss steals cars, outruns the
// Solmarina PD and works six jobs across a seeded coastal city. Everything
// runs off one state object, G; the classic scripts before this one each own
// one system (city, cars, peds, police, missions, render, HUD, save, audio).

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function makeGame() {
  const city = buildCity(20261119);
  const player = makePlayer(1280, 840);
  const G = {
    time: 0,
    state: 'title', // title | play | pause | busted | wasted
    city,
    player,
    cars: [],
    peds: [],
    cops: makeCops(),
    bullets: makeBullets(),
    particles: [],
    wanted: 0,
    wantedHeat: 0,
    wantedCool: 0,
    lastCrime: -99,
    mission: null,
    missionTime: 0,
    missionStops: null,
    missionStop: 0,
    missionCar: null,
    completedMissions: 0,
    lastCompleted: null,
    failedMission: null,
    toast: '',
    toastTime: 0,
    clockMin: 8 * 60, // 08:00
    clockText: '08:00',
    dusk: false,
    camera: { x: player.x, y: player.y, zoom: 1 },
    keys: {},
    mouse: { x: 0, y: 0, down: false },
    saveTimer: 0,
    sirenTimer: 0,
    scene: null,
  };
  // Traffic on the roads, pedestrians on the sidewalks.
  for (let i = 0; i < 12; i++) {
    const p = randomRoadPoint(Math.random);
    const car = makeCar(p.x, p.y, Math.random() * Math.PI * 2, {});
    car.target = randomRoadPoint(Math.random);
    G.cars.push(car);
  }
  G.peds = spawnPeds(26, city);
  applySave(G, loadGame());
  return G;
}

const G = makeGame();

// ---- input ----
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};
window.addEventListener('keydown', (e) => {
  AudioSys.init(); AudioSys.resume();
  const action = KEYMAP[e.code];
  if (action) { G.keys[action] = true; e.preventDefault(); }
  if (e.code === 'Enter') onEnter();
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyF') onPunch();
  if (e.code === 'KeyM') onMissionKey();
  if (e.code === 'KeyP' || e.code === 'Escape') onPauseKey();
  if (e.code === 'KeyN') { const m = AudioSys.toggleMute(); G.toast = m ? 'Muted' : 'Sound on'; G.toastTime = 1.5; }
  if (e.code === 'KeyR') onReload();
  if (e.code === 'Digit1') { G.player.weapon = 'fists'; G.toast = 'Fists'; G.toastTime = 1; }
  if (e.code === 'Digit2') { G.player.weapon = 'pistol'; G.toast = 'Pistol'; G.toastTime = 1; }
});
window.addEventListener('keyup', (e) => {
  const action = KEYMAP[e.code];
  if (action) G.keys[action] = false;
});
canvas.addEventListener('mousemove', (e) => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  AudioSys.init(); AudioSys.resume();
  G.mouse.x = e.clientX; G.mouse.y = e.clientY;
  if (G.state === 'title') { startPlay(); return; }
  if (G.state !== 'play') return;
  const w = screenToWorld(G, e.clientX, e.clientY);
  const shot = firePistol(G, w.x, w.y);
  if (shot) raiseWanted(G, 1);
});

function screenToWorld(G, sx, sy) {
  return {
    x: G.camera.x + (sx - canvas.width / 2) / G.camera.zoom,
    y: G.camera.y + (sy - canvas.height / 2) / G.camera.zoom,
  };
}

function onEnter() {
  if (G.state === 'title') startPlay();
  else if (G.state === 'busted' || G.state === 'wasted') respawn();
}
function startPlay() {
  G.state = 'play';
  AudioSys.startMusic();
}
function respawn() {
  const p = G.player;
  p.hp = 100; p.state = 'alive'; p.ammo = 24;
  p.x = 1280; p.y = 840;
  if (p.inCar) { p.inCar.isPlayer = false; p.inCar = null; }
  G.wanted = 0;
  G.cops = makeCops();
  G.bullets = [];
  G.state = 'play';
  G.toast = 'Back on the street. Stay sharp.';
  G.toastTime = 3;
  saveGame(G);
}
function onPauseKey() {
  if (G.state === 'play') G.state = 'pause';
  else if (G.state === 'pause') G.state = 'play';
}
function onMissionKey() {
  if (G.state !== 'play' || G.mission) return;
  const idx = nextMissionIndex(G);
  startMission(G, idx);
}
function onReload() {
  const p = G.player;
  if (p.weapon === 'pistol' && p.ammo < 24) {
    p.ammo = 24;
    G.toast = 'Reloaded';
    G.toastTime = 1;
    AudioSys.blip(440, 0.08, 'square', 0.08);
  }
}
function onInteract() {
  if (G.state !== 'play') return;
  const p = G.player;
  if (p.inCar) {
    if (Math.abs(p.inCar.speed) < 60) exitCar(p);
    return;
  }
  const car = nearestStealableCar(p, G.cars);
  if (car) {
    enterCar(p, car);
    raiseWanted(G, 1);
    G.toast = 'Stolen ' + car.name + ' — the law noticed!';
    G.toastTime = 2.5;
    AudioSys.blip(330, 0.12, 'square', 0.12);
  }
}
function onPunch() {
  if (G.state !== 'play') return;
  if (punch(G)) {
    if (G.time - G.lastCrime > 4) raiseWanted(G, 1);
  }
}

// ---- staging scenes (used by ?scene= and by shots.json) ----
function applyScene(G, name) {
  G.scene = name;
  G.state = 'play';
  const p = G.player;
  if (name === 'drive') {
    const car = makeCar(1280, 960, 0, { color: '#c0392b', name: 'Comet' });
    G.cars.push(car);
    enterCar(p, car);
    car.speed = 220;
    G.toast = '';
  } else if (name === 'chase') {
    const car = makeCar(1280, 960, 0, { color: '#2e86c1', name: 'Vagabond' });
    G.cars.push(car);
    enterCar(p, car);
    car.speed = 260;
    G.wanted = 3;
    spawnCopCar(G, 1080, 960);
    spawnCopCar(G, 1500, 960);
    spawnCopCar(G, 1280, 720);
    G.toast = 'Lose the cops!';
    G.toastTime = 5;
  } else if (name === 'mission') {
    const car = makeCar(640, 960, 0, { color: '#e67e22', name: 'Sunrunner' });
    G.cars.push(car);
    enterCar(p, car);
    car.speed = 240;
    startMission(G, 1); // Sunset Courier, 90s timer
    G.missionTime = 74;
  } else if (name === 'combat') {
    G.dusk = true;
    G.clockMin = 18 * 60 + 40;
    p.weapon = 'pistol';
    p.hp = 91;
    p.x = 960; p.y = 1200;
    G.wanted = 2;
    spawnCopFoot(G, 660, 1200);
    spawnCopFoot(G, 1260, 1200);
    spawnCopCar(G, 1120, 1200);
    G.toast = '';
  }
  G.camera.x = p.x; G.camera.y = p.y;
}

// ---- the loop ----
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (G.state === 'play') update(dt);
  render(ts);
}

function update(dt) {
  G.time += dt;
  G.clockMin += dt; // one game minute per real second
  if (G.clockMin >= 24 * 60) G.clockMin -= 24 * 60;
  const hh = Math.floor(G.clockMin / 60), mm = Math.floor(G.clockMin % 60);
  G.clockText = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  if (G.clockMin >= 17.5 * 60 && G.clockMin < 20 * 60) G.dusk = true;
  else if (G.scene !== 'combat') G.dusk = false;
  G.toastTime = Math.max(0, G.toastTime - dt);

  const p = G.player;
  const input = {
    up: !!G.keys.up, down: !!G.keys.down,
    left: !!G.keys.left, right: !!G.keys.right,
    run: !!G.keys.run,
  };

  if (p.state === 'alive') {
    if (p.inCar) {
      const car = p.inCar;
      driveCar(car, input, dt, isOnRoad(car.x, car.y));
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      if (car.hp <= 0) { exitCar(p); G.toast = 'The car died — find another one'; G.toastTime = 2.5; }
      AudioSys.setEngine(Math.abs(car.speed) / 460, true);
    } else {
      updatePlayerOnFoot(p, input, dt, G.city);
      AudioSys.setEngine(0, false);
    }
  }

  // Car-vs-car crashes.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const impact = collideCars(G.cars[i], G.cars[j]);
      if (impact > 120) {
        AudioSys.crash();
        if (G.cars[i].isPlayer || G.cars[j].isPlayer) {
          const mine = G.cars[i].isPlayer ? G.cars[i] : G.cars[j];
          damageCar(mine, 8);
        }
      }
    }
  }
  // Traffic keeps driving; parked cars stay put.
  for (const car of G.cars) {
    if (car.isTraffic && car.hp > 0) updateTraffic(car, dt, G.city);
    if (car.hp < 35 && car.hp > 0 && Math.random() < dt * 2) {
      G.particles.push({ x: car.x + (Math.random() - 0.5) * 20, y: car.y - 10, vx: 0, vy: -50, life: 0.6, max: 0.6, color: '#555', size: 5 });
    }
  }
  // Wrecked cars stay where they fell; traffic AI skips them (hp check above).

  // Pedestrians wander, flee from danger, and get knocked down.
  const danger = p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
  for (const ped of G.peds) updatePed(ped, dt, G.city, danger);
  for (const ped of G.peds) {
    const by = pedHitByCar(ped, G.cars);
    if (by === 'player' && G.time - G.lastCrime > 4) {
      raiseWanted(G, 1);
      G.toast = 'You hit a pedestrian!';
      G.toastTime = 2.5;
    }
  }

  updatePolice(G, dt);
  updateMission(G, dt);
  updateBullets(G, dt);

  // Particles drift and fade.
  for (const pt of G.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  G.particles = G.particles.filter(pt => pt.life > 0);

  // Camera follows the player.
  G.camera.x = lerp(G.camera.x, p.x, clamp(5 * dt, 0, 1));
  G.camera.y = lerp(G.camera.y, p.y, clamp(5 * dt, 0, 1));

  // Sirens while wanted.
  if (G.wanted > 0) {
    G.sirenTimer -= dt;
    if (G.sirenTimer <= 0) { AudioSys.siren(); G.sirenTimer = 2.4; }
  }

  // Busted / wasted transitions.
  if (p.state === 'busted') { G.state = 'busted'; saveGame(G); }
  if (p.state === 'wasted') { G.state = 'wasted'; saveGame(G); }

  // Autosave.
  G.saveTimer += dt;
  if (G.saveTimer > 15) { G.saveTimer = 0; saveGame(G); }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (G.state === 'title') {
    // A quiet attract shot of the city behind the title.
    G.camera.x = 1280; G.camera.y = 960;
    drawWorld(ctx, G);
    drawTitle(ctx, G);
    return;
  }
  drawWorld(ctx, G);
  drawHud(ctx, G);
  if (G.state === 'pause') drawPaused(ctx, G);
  if (G.state === 'busted') drawEnd(ctx, G, 'busted');
  if (G.state === 'wasted') drawEnd(ctx, G, 'wasted');
}

// ---- boot ----
(function boot() {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get('scene') || params.get('shot');
  if (scene) applyScene(G, scene);
  document.title = 'SOLMARINA ready';
  requestAnimationFrame(frame);
})();
