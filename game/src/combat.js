// SOLMARINA combat: pistol fire with mouse aim, fists, bullets, and the
// damage rules for peds, cars and police.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  function makeBullets() { return []; }

  function fireBullet(bullets, x, y, angle, owner) {
    bullets.push({
      x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * 780, vy: Math.sin(angle) * 780,
      life: 0.9, owner: owner
    });
  }

  function punch(pl, peds, police) {
    if (pl.punchT > 0 || pl.inCar) return;
    pl.punchT = 0.32;
    S.Audio.punch();
    var hx = pl.x + Math.cos(pl.angle) * 26, hy = pl.y + Math.sin(pl.angle) * 26;
    var hit = null;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (!p.dead && Math.hypot(p.x - hx, p.y - hy) < 24) { hit = p; break; }
    }
    if (hit) {
      hit.dead = true;
      S.Events && S.Events.emit('pedHit', hit, true);
      return;
    }
    for (var j = 0; j < police.length; j++) {
      var cop = police[j];
      if (!cop.dead && Math.hypot(cop.x - hx, cop.y - hy) < 26) {
        cop.hp -= 34;
        S.Events && S.Events.emit('copHit', cop);
        return;
      }
    }
  }

  function bulletStep(bullets, dt, world) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0 || City.isBlocked(b.x, b.y, 2) || City.isWater(b.x, b.y);
      if (dead) { bullets.splice(i, 1); continue; }
      // Hit a pedestrian.
      var consumed = false;
      for (var j = 0; j < world.peds.length; j++) {
        var p = world.peds[j];
        if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 12) {
          p.dead = true;
          S.Events && S.Events.emit('pedShot', p, b.owner);
          consumed = true; break;
        }
      }
      if (consumed) { bullets.splice(i, 1); continue; }
      // Hit a police officer on foot.
      for (var k = 0; k < world.police.length; k++) {
        var cop = world.police[k];
        if (cop.onFoot && !cop.dead && Math.hypot(cop.x - b.x, cop.y - b.y) < 13) {
          cop.hp -= 34;
          S.Events && S.Events.emit('copHit', cop);
          consumed = true; break;
        }
      }
      if (consumed) { bullets.splice(i, 1); continue; }
      // Hit a car (not the shooter's own).
      for (var m = 0; m < world.cars.length; m++) {
        var c = world.cars[m];
        if (c.dead) continue;
        if (b.owner === 'player' && c === world.player.inCar) continue;
        var lx = (b.x - c.x) * Math.cos(-c.angle) - (b.y - c.y) * Math.sin(-c.angle);
        var ly = (b.x - c.x) * Math.sin(-c.angle) + (b.y - c.y) * Math.cos(-c.angle);
        if (Math.abs(lx) < c.model.len / 2 && Math.abs(ly) < c.model.wid / 2) {
          c.hp -= 12;
          if (c.hp <= 0) {
            c.dead = true;
            S.Events && S.Events.emit('carWrecked', c);
          }
          consumed = true; break;
        }
      }
      if (consumed) { bullets.splice(i, 1); continue; }
      // Hit the player (police bullets only).
      if (b.owner === 'police' && !world.player.inCar) {
        if (Math.hypot(world.player.x - b.x, world.player.y - b.y) < 12) {
          S.Player.hurtPlayer(world.player, 9, b.x - b.vx * 0.02, b.y - b.vy * 0.02);
          bullets.splice(i, 1); continue;
        }
      }
      if (b.owner === 'police' && world.player.inCar) {
        var pc = world.player.inCar;
        var lx2 = (b.x - pc.x) * Math.cos(-pc.angle) - (b.y - pc.y) * Math.sin(-pc.angle);
        var ly2 = (b.x - pc.x) * Math.sin(-pc.angle) + (b.y - pc.y) * Math.cos(-pc.angle);
        if (Math.abs(lx2) < pc.model.len / 2 && Math.abs(ly2) < pc.model.wid / 2) {
          pc.hp -= 6;
          if (pc.hp <= 0) {
            pc.dead = true;
            S.Events && S.Events.emit('carWrecked', pc);
          }
          bullets.splice(i, 1);
        }
      }
    }
  }

  S.Combat = { makeBullets: makeBullets, fireBullet: fireBullet, punch: punch, bulletStep: bulletStep };
})();
