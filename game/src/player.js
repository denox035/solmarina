// SOLMARINA player: on-foot movement, stealing and driving cars, health,
// cash and the busted / wasted flow.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  function makePlayer(x, y) {
    return {
      x: x, y: y, angle: -Math.PI / 2,
      hp: 100, maxHp: 100, cash: 250,
      inCar: null, onFoot: true,
      speed: 0, walkPhase: 0,
      weapon: 'fists', ammo: 12, reloadT: 0,
      punchT: 0, hurtT: 0, dead: false,
      missionsDone: 0, storyDone: false
    };
  }

  function playerStep(pl, input, dt, cars) {
    if (pl.dead) return;
    if (pl.hurtT > 0) pl.hurtT -= dt;
    if (pl.punchT > 0) pl.punchT -= dt;
    if (pl.reloadT > 0) {
      pl.reloadT -= dt;
      if (pl.reloadT <= 0) pl.ammo = 12;
    }
    if (pl.inCar) return; // driving is handled by Vehicles.drive in main
    var run = input.shift ? 1.6 : 1;
    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      var len = Math.hypot(mx, my);
      mx /= len; my /= len;
      var sp = 165 * run;
      var pos = City.moveWithCollision(pl.x, pl.y, mx * sp * dt, my * sp * dt, 11);
      pl.x = pos.x; pl.y = pos.y;
      pl.angle = Math.atan2(my, mx);
      pl.walkPhase += dt * sp * 0.06;
      pl.speed = sp;
    } else {
      pl.speed = 0;
    }
  }

  function tryEnterCar(pl, cars) {
    if (pl.inCar) return null;
    var car = S.Vehicles.nearestCar(pl.x, pl.y, cars, 64);
    if (!car) return null;
    pl.inCar = car;
    car.kind = 'player';
    car.speed = 0;
    S.Audio.steal();
    S.Events && S.Events.emit('carStolen', car);
    return car;
  }

  function exitCar(pl) {
    if (!pl.inCar) return;
    var car = pl.inCar;
    var side = Math.cos(car.angle + Math.PI / 2), sideY = Math.sin(car.angle + Math.PI / 2);
    var px = car.x + side * 26, py = car.y + sideY * 26;
    if (City.isBlocked(px, py, 11)) { px = car.x - side * 26; py = car.y - sideY * 26; }
    pl.x = px; pl.y = py;
    pl.angle = car.angle;
    pl.inCar = null;
    car.kind = 'traffic';
    car.speed = 0;
  }

  function hurtPlayer(pl, dmg, fromX, fromY) {
    if (pl.dead || pl.hurtT > 0) return;
    pl.hp -= dmg;
    pl.hurtT = 0.5;
    if (fromX !== undefined) {
      var d = Math.hypot(pl.x - fromX, pl.y - fromY) || 1;
      pl.x += (pl.x - fromX) / d * 8;
      pl.y += (pl.y - fromY) / d * 8;
    }
    if (pl.hp <= 0) {
      pl.hp = 0;
      pl.dead = true;
      if (pl.inCar) { pl.inCar.kind = 'traffic'; pl.inCar = null; }
      S.Events && S.Events.emit('playerDown', pl);
    }
  }

  function respawn(pl, place) {
    pl.hp = pl.maxHp;
    pl.dead = false;
    pl.x = place.x; pl.y = place.y;
    pl.angle = -Math.PI / 2;
    pl.inCar = null;
  }

  S.Player = {
    makePlayer: makePlayer, playerStep: playerStep,
    tryEnterCar: tryEnterCar, exitCar: exitCar,
    hurtPlayer: hurtPlayer, respawn: respawn
  };
})();
