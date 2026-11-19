// SOLMARINA vehicles: car models, arcade driving physics, traffic AI that
// follows the road graph, and the spawn/stolen-car rules.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  var MODELS = [
    { name: 'Sol hatchback', color: '#d8d8d8', len: 34, wid: 17, accel: 240, top: 340, turn: 3.1, hp: 100 },
    { name: 'Marina sedan', color: '#3f6fb5', len: 38, wid: 18, accel: 260, top: 380, turn: 2.9, hp: 110 },
    { name: 'Solmarina GT', color: '#e33e2b', len: 40, wid: 19, accel: 330, top: 520, turn: 3.4, hp: 120 },
    { name: 'Palm taxi', color: '#f2c230', len: 38, wid: 18, accel: 250, top: 360, turn: 3.0, hp: 110 },
    { name: 'Bay pickup', color: '#5a7a4a', len: 42, wid: 19, accel: 230, top: 330, turn: 2.7, hp: 140 },
    { name: 'Dune buggy', color: '#e08a2e', len: 34, wid: 18, accel: 300, top: 400, turn: 3.6, hp: 90 }
  ];
  var POLICE_COLORS = ['#1c2f4d', '#22406b'];

  function makeCar(x, y, angle, model, kind) {
    return {
      x: x, y: y, angle: angle, speed: 0,
      model: model, kind: kind || 'traffic',
      hp: model.hp, maxHp: model.hp,
      target: null, wait: 0, honk: 0,
      dead: false, brakeLight: false
    };
  }

  // Arcade car physics: forward accel, drag, steering scaled by speed.
  function drive(car, throttle, steer, dt) {
    var m = car.model;
    car.speed += throttle * m.accel * dt;
    car.speed -= car.speed * 0.9 * dt;             // drag
    if (car.speed > m.top) car.speed = m.top;
    if (car.speed < -m.top * 0.45) car.speed = -m.top * 0.45;
    if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
    var grip = Math.min(1, Math.abs(car.speed) / 90);
    car.angle += steer * m.turn * grip * dt * (car.speed >= 0 ? 1 : -1);
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Move with collision: try each axis separately so cars slide along walls.
    var r = Math.max(m.len, m.wid) * 0.42;
    var hit = false;
    if (!City.isBlocked(nx, car.y, r)) { car.x = nx; } else { hit = true; }
    if (!City.isBlocked(car.x, ny, r)) { car.y = ny; } else { hit = true; }
    if (hit && Math.abs(car.speed) > 120) {
      car.hp -= Math.abs(car.speed) * 0.06;
      car.speed *= 0.35;
      S.Events && S.Events.emit('crash', car);
    } else if (hit) {
      car.speed *= 0.5;
    }
    // Keep cars off the water and out of the park.
    if (City.isWater(car.x, car.y)) { car.x -= Math.cos(car.angle) * car.speed * dt; car.y -= Math.sin(car.angle) * car.speed * dt; car.speed *= 0.4; }
    return car;
  }

  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // Traffic AI: pick a neighbouring intersection, drive toward it, repeat.
  function trafficStep(car, dt, allCars) {
    if (!car.target) {
      var near = City.nearestIntersection(car.x, car.y);
      var opts = City.intersections.filter(function (p) {
        var sameX = Math.abs(p.x - near.x) < 1 && p.y !== near.y;
        var sameY = Math.abs(p.y - near.y) < 1 && p.x !== near.x;
        return sameX || sameY;
      });
      car.target = opts.length ? opts[Math.floor(Math.random() * opts.length)] : near;
    }
    var want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    var diff = angleDiff(car.angle, want);
    var steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Slow for the car ahead.
    var throttle = 0.55;
    for (var i = 0; i < allCars.length; i++) {
      var o = allCars[i];
      if (o === car || o.dead) continue;
      var dx = o.x - car.x, dy = o.y - car.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      if (ahead > 0 && dist < 70 && Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy) < 26) {
        throttle = 0; car.brakeLight = true; break;
      }
    }
    if (throttle > 0) car.brakeLight = false;
    var dxT = car.target.x - car.x, dyT = car.target.y - car.y;
    if (dxT * dxT + dyT * dyT < 30 * 30) {
      car.target = null;
      if (Math.random() < 0.06) car.wait = 0.6; // occasional pause at the junction
    }
    if (car.wait > 0) { car.wait -= dt; drive(car, 0, 0, dt); return; }
    drive(car, throttle, steer, dt);
  }

  function spawnTraffic(n, avoid) {
    var cars = [];
    for (var i = 0; i < n; i++) {
      var p = City.randomRoadPoint();
      var angle = Math.random() < 0.5 ? 0 : Math.PI / 2;
      if (Math.random() < 0.5) angle += Math.PI;
      var model = MODELS[Math.floor(Math.random() * MODELS.length)];
      var c = makeCar(p.x, p.y, angle, model, 'traffic');
      c.speed = 90 + Math.random() * 80;
      if (avoid && Math.hypot(c.x - avoid.x, c.y - avoid.y) < 260) { i--; continue; }
      cars.push(c);
    }
    return cars;
  }

  function nearestCar(x, y, cars, maxDist) {
    var best = null, bd = maxDist * maxDist;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.dead || c.kind === 'police') continue;
      var dx = c.x - x, dy = c.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  S.Vehicles = {
    MODELS: MODELS, POLICE_COLORS: POLICE_COLORS,
    makeCar: makeCar, drive: drive, trafficStep: trafficStep,
    spawnTraffic: spawnTraffic, nearestCar: nearestCar, angleDiff: angleDiff
  };
})();
