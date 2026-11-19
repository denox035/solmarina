// SOLMARINA pedestrians: sidewalk walkers with panic behaviour — they flee
// gunfire and speeding cars, and they remember being hit.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  var SHIRTS = ['#e85d75', '#4a90d9', '#f2a541', '#7bc47f', '#9b59b6', '#e8e8e8', '#34495e', '#ff8c69'];
  var SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

  function makePed(x, y) {
    var onRoad = City.isRoad(x, y);
    return {
      x: x, y: y, angle: Math.random() * Math.PI * 2,
      speed: 26 + Math.random() * 22, state: 'walk',
      shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
      skin: SKINS[Math.floor(Math.random() * SKINS.length)],
      panic: 0, target: null, dead: false, hitFlash: 0,
      stepPhase: Math.random() * Math.PI * 2
    };
  }

  function spawnPeds(n, avoid) {
    var peds = [];
    for (var i = 0; i < n; i++) {
      var p = City.randomRoadPoint();
      // Push the walker onto the sidewalk edge of the road.
      p.x += (Math.random() < 0.5 ? -1 : 1) * (City.ROAD_W / 2 + 8);
      if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y) < 200) { i--; continue; }
      peds.push(makePed(p.x, p.y));
    }
    return peds;
  }

  function scare(peds, x, y, radius) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.dead) continue;
      var d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.state = 'panic';
        p.panic = 2.5 + Math.random();
        p.angle = Math.atan2(p.y - y, p.x - x);
      }
    }
  }

  function pedStep(p, dt, cars, player) {
    if (p.dead) return;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.panic > 0) {
      p.panic -= dt;
      if (p.panic <= 0) p.state = 'walk';
    }
    var sp = p.state === 'panic' ? p.speed * 3.4 : p.speed;
    // Pick a new ambling direction now and then, staying near roads.
    if (p.state === 'walk' && Math.random() < dt * 0.25) {
      p.angle += (Math.random() - 0.5) * 1.6;
    }
    if (p.state === 'panic' && Math.random() < dt * 0.8) {
      p.angle += (Math.random() - 0.5) * 1.2;
    }
    var nx = p.x + Math.cos(p.angle) * sp * dt;
    var ny = p.y + Math.sin(p.angle) * sp * dt;
    if (!City.isBlocked(nx, ny, 8) && !City.isWater(nx, ny)) { p.x = nx; p.y = ny; }
    else { p.angle += Math.PI / 2 + (Math.random() - 0.5); }
    p.stepPhase += dt * sp * 0.18;
    // Hit by a fast car?
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.dead) continue;
      var d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < 22 && Math.abs(c.speed) > 60) {
        p.dead = true;
        p.hitFlash = 1;
        // Only the player's own car raises the player's wanted level.
        S.Events && S.Events.emit('pedHit', p, c === player.inCar);
        return;
      }
    }
    // Bump into the player on foot: just push aside.
    if (player && !player.inCar) {
      var d2 = Math.hypot(player.x - p.x, player.y - p.y);
      if (d2 < 18 && d2 > 0.01) {
        p.x -= (player.x - p.x) / d2 * 14 * dt * 4;
        p.y -= (player.y - p.y) / d2 * 14 * dt * 4;
      }
    }
  }

  S.Peds = { makePed: makePed, spawnPeds: spawnPeds, scare: scare, pedStep: pedStep };
})();
