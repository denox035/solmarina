// SOLMARINA police: the wanted level, pursuit cars, foot officers, and the
// busted / escape rules.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  function makeWanted() {
    return { stars: 0, heat: 0, lastSeen: 0, calmT: 0 };
  }

  function addHeat(wanted, amount, reason) {
    var before = wanted.stars;
    wanted.heat += amount;
    var stars = wanted.heat >= 260 ? 5 : wanted.heat >= 170 ? 4 :
                wanted.heat >= 100 ? 3 : wanted.heat >= 45 ? 2 :
                wanted.heat >= 12 ? 1 : 0;
    wanted.stars = stars;
    wanted.calmT = 0;
    if (stars > before) S.Events && S.Events.emit('wantedUp', stars, reason);
  }

  function wantedStep(wanted, dt, policeNear, playerHidden) {
    if (wanted.stars === 0) return;
    if (!policeNear && playerHidden) {
      wanted.calmT += dt;
      if (wanted.calmT > 14) {
        wanted.heat = Math.max(0, wanted.heat - dt * 9);
        var stars = wanted.heat >= 260 ? 5 : wanted.heat >= 170 ? 4 :
                    wanted.heat >= 100 ? 3 : wanted.heat >= 45 ? 2 :
                    wanted.heat >= 12 ? 1 : 0;
        if (stars < wanted.stars) {
          wanted.stars = stars;
          S.Events && S.Events.emit('wantedDown', stars);
        }
        if (wanted.stars === 0) wanted.calmT = 0;
      }
    } else {
      wanted.calmT = 0;
    }
  }

  function makeCopCar(x, y, angle) {
    var model = { name: 'Interceptor', color: '#1c2f4d', len: 40, wid: 19,
      accel: 360, top: 540, turn: 3.5, hp: 150 };
    var car = S.Vehicles.makeCar(x, y, angle, model, 'police');
    car.sirenT = Math.random() * 10;
    return car;
  }

  function makeCopFoot(x, y) {
    return { x: x, y: y, angle: 0, onFoot: true, hp: 68, dead: false,
      shootT: 1 + Math.random(), speed: 120 };
  }

  // Pursuit: steer hard at the player, ram to damage, and at 3+ stars shoot
  // from the window when close.
  function copCarStep(car, dt, px, py, pAngle, bullets) {
    var want = Math.atan2(py - car.y, px - car.x);
    var diff = S.Vehicles.angleDiff(car.angle, want);
    var steer = Math.max(-1, Math.min(1, diff * 2.6));
    var dist = Math.hypot(px - car.x, py - car.y);
    var throttle = dist > 60 ? 1 : 0.7;
    S.Vehicles.drive(car, throttle, steer, dt);
    // Ram damage.
    if (dist < 46) {
      S.Events && S.Events.emit('ram', car, dist);
    }
    // Shoot out of the window at 3+ stars when close and roughly facing.
    if (bullets && dist < 320 && Math.abs(diff) < 0.5) {
      car.shootT = (car.shootT || 0) - dt;
      if (car.shootT <= 0) {
        car.shootT = 1.1 + Math.random() * 0.7;
        var a = Math.atan2(py - car.y, px - car.x) + (Math.random() - 0.5) * 0.22;
        S.Combat.fireBullet(bullets, car.x, car.y, a, 'police');
        S.Audio.shot();
      }
    }
  }

  function copFootStep(cop, dt, px, py, bullets, playerInCar) {
    if (cop.dead) return;
    var dist = Math.hypot(px - cop.x, py - cop.y);
    cop.angle = Math.atan2(py - cop.y, px - cop.x);
    if (dist > 190) {
      var pos = City.moveWithCollision(cop.x, cop.y,
        Math.cos(cop.angle) * cop.speed * dt, Math.sin(cop.angle) * cop.speed * dt, 10);
      cop.x = pos.x; cop.y = pos.y;
    } else if (dist < 60 && !playerInCar) {
      // Close enough to grab the player: busted.
      S.Events && S.Events.emit('busted', cop);
    }
    if (dist < 340 && !playerInCar) {
      cop.shootT -= dt;
      if (cop.shootT <= 0) {
        cop.shootT = 1.3 + Math.random() * 0.8;
        var a = Math.atan2(py - cop.y, px - cop.x) + (Math.random() - 0.5) * 0.25;
        S.Combat.fireBullet(bullets, cop.x, cop.y, a, 'police');
        S.Audio.shot();
      }
    }
  }

  // Keep the right number of pursuit cars for the wanted level.
  function ensurePursuit(police, wanted, px, py) {
    var want = wanted.stars === 0 ? 0 : wanted.stars <= 1 ? 1 :
              wanted.stars <= 2 ? 2 : wanted.stars <= 3 ? 3 : 4;
    var cars = police.filter(function (p) { return !p.onFoot && !p.dead; });
    while (cars.length < want) {
      var a = Math.random() * Math.PI * 2;
      var d = 620 + Math.random() * 260;
      var x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      var p = City.nearestIntersection(x, y);
      if (p) { x = p.x; y = p.y; }
      x = Math.max(60, Math.min(City.W - 60, x));
      y = Math.max(60, Math.min(City.H - 60, y));
      var car = makeCopCar(x, y, Math.atan2(py - y, px - x));
      police.push(car);
      cars.push(car);
    }
    // Despawn far-away or dead pursuit cars when the heat is gone.
    for (var i = police.length - 1; i >= 0; i--) {
      var c = police[i];
      if (!c.onFoot && (c.dead || (wanted.stars === 0 && Math.hypot(c.x - px, c.y - py) > 900))) {
        police.splice(i, 1);
      }
      if (c.onFoot && c.dead) police.splice(i, 1);
    }
  }

  S.Police = {
    makeWanted: makeWanted, addHeat: addHeat, wantedStep: wantedStep,
    makeCopCar: makeCopCar, makeCopFoot: makeCopFoot,
    copCarStep: copCarStep, copFootStep: copFootStep, ensurePursuit: ensurePursuit
  };
})();
