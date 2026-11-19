// SOLMARINA main: boot, event bus, input, camera, game loop, state machine
// (title / play / pause / busted / wasted) and the staged screenshot scenes.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  // ---- tiny event bus (other modules emit into it at run time) ----
  var handlers = {};
  S.Events = {
    on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    emit: function (ev) {
      var args = Array.prototype.slice.call(arguments, 1);
      var list = handlers[ev] || [];
      for (var i = 0; i < list.length; i++) list[i].apply(null, args);
    }
  };

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  function fitCanvas() {
    var scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    canvas.style.width = Math.floor(1280 * scale) + 'px';
    canvas.style.height = Math.floor(720 * scale) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  var params = new URLSearchParams(window.location.search);
  var scene = params.get('scene') || '';

  // ---- world ----
  var w = {
    state: 'title', time: 0, clockMinutes: 9 * 60,
    player: null, cars: [], peds: [], police: [], bullets: [],
    wanted: S.Police.makeWanted(), missions: S.Missions.makeMissions(),
    toasts: [], cam: { x: 0, y: 0 }, dusk: false,
    fine: 0, endKind: '', saveExists: S.Save.exists(),
    lastRamT: -10, lastCrashT: -10, sprayCooldown: 0,
    mouse: { x: 640, y: 360, down: false }
  };
  w.toast = function (text, life) {
    w.toasts.push({ text: text, life: life || 3 });
    if (w.toasts.length > 3) w.toasts.shift();
  };
  Object.defineProperty(w, 'clock', {
    get: function () {
      var h = Math.floor(w.clockMinutes / 60) % 24;
      var m = Math.floor(w.clockMinutes % 60);
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
  });
  window.SOL.world = w;

  function freshWorld(spawn) {
    w.player = S.Player.makePlayer(spawn.x, spawn.y);
    w.cars = S.Vehicles.spawnTraffic(14, spawn);
    w.peds = S.Peds.spawnPeds(24, spawn);
    w.police = [];
    w.bullets = S.Combat.makeBullets();
    w.wanted = S.Police.makeWanted();
    w.missions = S.Missions.makeMissions();
    w.toasts = [];
    w.dusk = false;
    w.demoDrive = false;
  }

  // ---- events ----
  S.Events.on('carStolen', function () {
    S.Police.addHeat(w.wanted, 12, 'car stolen');
    w.toast('Car stolen! The PD noticed.', 3);
  });
  S.Events.on('pedHit', function (ped, byPlayer) {
    if (!byPlayer) return; // traffic accidents are not the player's crime
    S.Police.addHeat(w.wanted, 25, 'pedestrian hit');
    w.toast('You hit a pedestrian!', 2);
  });
  S.Events.on('pedShot', function (ped, owner) {
    if (owner !== 'player') return;
    S.Police.addHeat(w.wanted, 30, 'pedestrian shot');
  });
  S.Events.on('copHit', function () {
    S.Police.addHeat(w.wanted, 30, 'officer hit');
  });
  S.Events.on('crash', function () {
    if (w.time - w.lastCrashT > 0.8) { w.lastCrashT = w.time; S.Audio.crash(); }
  });
  S.Events.on('ram', function (car, dist) {
    if (w.time - w.lastRamT > 0.7 && w.player.inCar) {
      w.lastRamT = w.time;
      w.player.inCar.hp -= 9;
      S.Audio.crash();
      if (w.player.inCar.hp <= 0) {
        w.player.inCar.dead = true;
        S.Events.emit('carWrecked', w.player.inCar);
      }
    }
  });
  S.Events.on('carWrecked', function (car) {
    if (w.player.inCar === car) {
      S.Player.exitCar(w.player);
      w.toast('Your car is wrecked!', 3);
    }
  });
  S.Events.on('playerDown', function () {
    endGame('wasted');
  });
  S.Events.on('busted', function () {
    endGame('busted');
  });
  S.Events.on('wantedUp', function (stars) {
    if (stars >= 1) { S.Audio.siren.start(); S.Audio.siren.set(true); }
  });
  S.Events.on('wantedDown', function (stars) {
    if (stars === 0) S.Audio.siren.set(false);
  });
  S.Events.on('missionDone', function () { S.Save.save(w); });

  function endGame(kind) {
    if (w.state !== 'play') return;
    w.endKind = kind;
    w.state = 'end';
    w.fine = Math.min(w.player.cash, kind === 'busted' ? 200 : 150);
    w.player.cash -= w.fine;
    S.Audio.busted();
    S.Audio.siren.set(false);
    S.Audio.engine.set(0, false);
  }

  function respawnAfterEnd() {
    var place = w.endKind === 'busted'
      ? { x: City.policeHQ.x + 80, y: City.policeHQ.y + 40 }
      : { x: City.hospital.x + 80, y: City.hospital.y + 40 };
    S.Player.respawn(w.player, place);
    w.wanted = S.Police.makeWanted();
    w.police = [];
    w.state = 'play';
    w.toast(w.endKind === 'busted' ? 'Walk free. Stay clean out there.' : 'Patched up. Back on your feet.', 3);
  }

  // ---- input ----
  var keys = {};
  var input = { up: false, down: false, left: false, right: false, shift: false };
  function refreshInput() {
    input.up = !!(keys['KeyW'] || keys['ArrowUp']);
    input.down = !!(keys['KeyS'] || keys['ArrowDown']);
    input.left = !!(keys['KeyA'] || keys['ArrowLeft']);
    input.right = !!(keys['KeyD'] || keys['ArrowRight']);
    input.shift = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
  }
  window.addEventListener('keydown', function (e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    S.Audio.unlock();
    if (e.repeat) return;
    keys[e.code] = true;
    refreshInput();
    if (w.state === 'title') {
      if (e.code === 'Enter') startGame(false);
      else if (e.code === 'KeyN') startGame(true);
      return;
    }
    if (w.state === 'end') {
      if (e.code === 'Enter') respawnAfterEnd();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (w.state === 'play') w.state = 'pause';
      else if (w.state === 'pause') w.state = 'play';
      return;
    }
    if (w.state !== 'play') return;
    if (e.code === 'KeyE') {
      if (w.player.inCar) S.Player.exitCar(w.player);
      else S.Player.tryEnterCar(w.player, w.cars);
    } else if (e.code === 'KeyF') {
      S.Combat.punch(w.player, w.peds, w.police.filter(function (p) { return p.onFoot; }));
    } else if (e.code === 'Digit1') { w.player.weapon = 'fists'; }
    else if (e.code === 'Digit2') { w.player.weapon = 'pistol'; }
    else if (e.code === 'KeyM') {
      if (!w.missions.active) {
        if (!S.Missions.startMission(w)) w.toast('No more jobs — story complete!', 3);
      }
    } else if (e.code === 'KeyN') {
      w.toast(S.Audio.toggleMute() ? 'Muted' : 'Sound on', 1.5);
    } else if (e.code === 'KeyR' && w.state === 'pause') {
      freshWorld({ x: 800, y: 720 });
      w.state = 'play';
    }
  });
  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
    refreshInput();
  });
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    w.mouse.x = (e.clientX - r.left) * (1280 / r.width);
    w.mouse.y = (e.clientY - r.top) * (720 / r.height);
  });
  canvas.addEventListener('mousedown', function (e) {
    S.Audio.unlock();
    if (w.state !== 'play') return;
    if (w.player.inCar || w.player.dead) return;
    if (w.player.weapon !== 'pistol') return;
    if (w.player.reloadT > 0) return;
    if (w.player.ammo <= 0) { w.player.reloadT = 1.2; return; }
    w.player.ammo--;
    var aim = Math.atan2(w.mouse.y + w.cam.y - w.player.y, w.mouse.x + w.cam.x - w.player.x);
    w.player.aimAngle = aim;
    S.Combat.fireBullet(w.bullets, w.player.x, w.player.y, aim, 'player');
    S.Audio.shot();
    S.Peds.scare(w.peds, w.player.x, w.player.y, 260);
    S.Police.addHeat(w.wanted, 6, 'shots fired');
    if (w.player.ammo <= 0) w.player.reloadT = 1.2;
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function startGame(fresh) {
    if (fresh) S.Save.clear();
    var spawn = { x: 800, y: 720 };
    freshWorld(spawn);
    var saved = fresh ? null : S.Save.load();
    if (saved) {
      S.Save.applySave(w, saved);
      w.toast('Welcome back — $' + w.player.cash + ', ' + w.player.missionsDone + ' jobs done', 4);
    }
    w.state = 'play';
    S.Audio.music.start();
    S.Audio.engine.start();
  }

  // ---- staged scenes for screenshots (real gameplay states) ----
  function stageScene(name) {
    if (name === 'drive') {
      freshWorld({ x: 800, y: 1000 });
      var car = S.Vehicles.makeCar(800, 1000, 0, S.Vehicles.MODELS[2], 'player');
      w.cars.push(car);
      w.player.inCar = car;
      w.player.x = car.x; w.player.y = car.y;
      w.demoDrive = true;
      w.clockMinutes = 10 * 60 + 20;
    } else if (name === 'chase') {
      freshWorld({ x: 480, y: 720 });
      var gt = S.Vehicles.makeCar(480, 720, 0, S.Vehicles.MODELS[2], 'player');
      w.cars.push(gt);
      w.player.inCar = gt;
      w.player.x = gt.x; w.player.y = gt.y;
      w.demoDrive = true;
      S.Police.addHeat(w.wanted, 110, 'staged chase');
      // Three pursuit cars start on the same road, closing in.
      var spots = [[-260, 0], [-430, 0], [380, 0]];
      for (var si = 0; si < spots.length; si++) {
        var cx = w.player.x + spots[si][0], cy = w.player.y + spots[si][1];
        w.police.push(S.Police.makeCopCar(cx, cy, 0));
      }
      w.toast('Lose the cops!', 4);
      w.clockMinutes = 16 * 60 + 40;
    } else if (name === 'mission') {
      freshWorld({ x: 480, y: 440 });
      var sedan = S.Vehicles.makeCar(480, 440, 0, S.Vehicles.MODELS[1], 'player');
      w.cars.push(sedan);
      w.player.inCar = sedan;
      w.player.x = sedan.x; w.player.y = sedan.y;
      w.demoDrive = true;
      w.missions.index = 1;
      S.Missions.startMission(w);
      w.clockMinutes = 17 * 60 + 5;
    } else if (name === 'combat') {
      freshWorld({ x: City.MARINA_X + 60, y: 900 });
      w.dusk = true;
      w.player.x = City.MARINA_X + 60; w.player.y = 900;
      w.player.weapon = 'pistol';
      S.Police.addHeat(w.wanted, 50, 'staged combat');
      var c1 = S.Police.makeCopFoot(w.player.x - 220, w.player.y - 60);
      var c2 = S.Police.makeCopFoot(w.player.x - 260, w.player.y + 90);
      w.police.push(c1, c2);
      S.Peds.scare(w.peds, w.player.x, w.player.y, 500);
      w.clockMinutes = 19 * 60 + 10;
    } else {
      freshWorld({ x: 800, y: 720 });
    }
    w.state = 'play';
    S.Audio.music.start();
    S.Audio.engine.start();
  }

  // ---- simulation ----
  function step(dt) {
    w.time += dt;
    w.clockMinutes += dt * 0.5;
    for (var i = w.toasts.length - 1; i >= 0; i--) {
      w.toasts[i].life -= dt;
      if (w.toasts[i].life <= 0) w.toasts.splice(i, 1);
    }
    var pl = w.player;
    // Aim follows the mouse on foot.
    if (!pl.inCar && !pl.dead) {
      pl.aimAngle = Math.atan2(w.mouse.y + w.cam.y - pl.y, w.mouse.x + w.cam.x - pl.x);
    }
    // Player: on foot or driving. In staged scenes the car cruises itself
    // (attract mode) so screenshots show the city alive.
    if (pl.inCar) {
      var car = pl.inCar;
      if (w.demoDrive) {
        S.Vehicles.trafficStep(car, dt, w.cars);
        pl.x = car.x; pl.y = car.y; pl.angle = car.angle;
        S.Audio.engine.set(Math.abs(car.speed) / car.model.top, true);
      } else {
        var throttle = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
        var steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        S.Vehicles.drive(car, throttle, steer, dt);
        pl.x = car.x; pl.y = car.y; pl.angle = car.angle;
        S.Audio.engine.set(Math.abs(car.speed) / car.model.top, true);
      }
      if (car.hp <= 0 && !car.dead) {
        car.dead = true;
        S.Events.emit('carWrecked', car);
      }
      // Pay N Spray: drive through to clear the heat for $100.
      w.sprayCooldown -= dt;
      var sp = City.spray;
      if (w.wanted.stars > 0 && w.sprayCooldown <= 0 &&
          Math.hypot(pl.x - (sp.x + sp.w / 2), pl.y - (sp.y + sp.h / 2)) < 80 &&
          pl.cash >= 100) {
        pl.cash -= 100;
        w.wanted.heat = 0; w.wanted.stars = 0;
        S.Audio.siren.set(false);
        w.sprayCooldown = 5;
        w.toast('Pay N Spray — heat cleared, -$100', 3);
      }
    } else {
      S.Player.playerStep(pl, input, dt, w.cars);
      S.Audio.engine.set(0, false);
    }
    // Traffic.
    for (var ci = 0; ci < w.cars.length; ci++) {
      var c = w.cars[ci];
      if (c.dead || c === pl.inCar) continue;
      S.Vehicles.trafficStep(c, dt, w.cars);
    }
    // Replace wrecked / vanished traffic.
    w.cars = w.cars.filter(function (c) { return !c.dead || c === pl.inCar; });
    if (w.cars.length < 14 && Math.random() < dt * 0.5) {
      var extra = S.Vehicles.spawnTraffic(1, pl);
      if (extra.length) w.cars.push(extra[0]);
    }
    // Pedestrians.
    for (var pi = 0; pi < w.peds.length; pi++) {
      S.Peds.pedStep(w.peds[pi], dt, w.cars, pl);
    }
    w.peds = w.peds.filter(function (p) { return !p.dead; });
    if (w.peds.length < 22 && Math.random() < dt * 0.8) {
      var np = S.Peds.spawnPeds(1, pl);
      if (np.length) w.peds.push(np[0]);
    }
    // Police.
    var px = pl.x, py = pl.y;
    S.Police.ensurePursuit(w.police, w.wanted, px, py);
    var anyNear = false;
    for (var qi = 0; qi < w.police.length; qi++) {
      var cop = w.police[qi];
      if (cop.dead) continue;
      if (cop.onFoot) {
        S.Police.copFootStep(cop, dt, px, py, w.bullets, !!pl.inCar);
      } else {
        S.Police.copCarStep(cop, dt, px, py, pl.angle, w.bullets);
      }
      if (Math.hypot(cop.x - px, cop.y - py) < 520) anyNear = true;
    }
    // Foot officers join when the player is on foot at 2+ stars.
    if (w.wanted.stars >= 2 && !pl.inCar) {
      var foots = w.police.filter(function (p) { return p.onFoot && !p.dead; }).length;
      if (foots < 2 && Math.random() < dt * 0.3) {
        var a = Math.random() * Math.PI * 2;
        w.police.push(S.Police.makeCopFoot(px + Math.cos(a) * 420, py + Math.sin(a) * 420));
      }
    }
    S.Police.wantedStep(w.wanted, dt, anyNear, !anyNear);
    // Bullets + missions.
    S.Combat.bulletStep(w.bullets, dt, w);
    S.Missions.missionStep(w, dt);
    // Camera follows the player.
    var tx = Math.max(0, Math.min(City.W - 1280, pl.x - 640));
    var ty = Math.max(0, Math.min(City.H - 720, pl.y - 360));
    w.cam.x += (tx - w.cam.x) * Math.min(1, dt * 5);
    w.cam.y += (ty - w.cam.y) * Math.min(1, dt * 5);
  }

  function draw() {
    ctx.save();
    if (w.state === 'title') {
      S.HUD.drawTitle(ctx, w);
    } else {
      ctx.clearRect(0, 0, 1280, 720);
      ctx.translate(-Math.round(w.cam.x), -Math.round(w.cam.y));
      S.Render.drawWorld(ctx, w, w.cam, w.dusk);
      ctx.restore();
      ctx.save();
      S.HUD.drawHUD(ctx, w);
      if (w.state === 'pause') S.HUD.drawPause(ctx, w);
      if (w.state === 'end') S.HUD.drawEnd(ctx, w, w.endKind);
    }
    ctx.restore();
  }

  var last = performance.now();
  var booted = false;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (w.state === 'play') step(dt);
    else w.time += dt;
    draw();
    if (!booted) {
      booted = true;
      document.title = 'SOLMARINA ready';
      window.__solReady = true;
    }
    requestAnimationFrame(loop);
  }

  // Boot: title screen, or straight into a staged scene for screenshots.
  if (scene) stageScene(scene);
  else freshWorld({ x: 800, y: 720 });
  requestAnimationFrame(loop);
})();
