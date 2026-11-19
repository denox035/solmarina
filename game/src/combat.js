// combat.js — fists and a pistol. The player aims with the mouse; bullets
// fly straight, damage cars and officers, and spark on walls. Fists are
// short range with a swing cooldown. Only the player's shots count as crimes.

function makeBullets() { return []; }

function firePistol(G, tx, ty) {
  const p = G.player;
  if (p.weapon !== 'pistol' || p.ammo <= 0 || p.shootCooldown > 0) return null;
  if (p.inCar) return null; // the pistol stays holstered while driving
  p.ammo--;
  p.shootCooldown = 0.28;
  const a = Math.atan2(ty - p.y, tx - p.x);
  const b = { x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 0.9, from: 'player' };
  G.bullets.push(b);
  AudioSys.gunshot();
  G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#f7dc6f', size: 7 });
  return b;
}

function fireCopBullet(G, cop, tx, ty) {
  const a = Math.atan2(ty - cop.y, tx - cop.x);
  G.bullets.push({ x: cop.x + Math.cos(a) * 22, y: cop.y + Math.sin(a) * 22, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.8, from: 'cop' });
  AudioSys.gunshot();
}

function punch(G) {
  const p = G.player;
  if (p.weapon !== 'fists' || p.punchCooldown > 0 || p.inCar) return false;
  p.punchCooldown = 0.45;
  AudioSys.punch();
  const reach = 46;
  const px = p.x + Math.cos(p.angle) * reach, py = p.y + Math.sin(p.angle) * reach;
  // Knock a pedestrian down, or dent a nearby car.
  for (const ped of G.peds) {
    if (ped.state !== 'down' && dist2(px, py, ped.x, ped.y) < 30 * 30) {
      ped.state = 'down'; ped.down = 3;
      G.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -30, life: 0.4, max: 0.4, color: '#f5b041', size: 6 });
      return true;
    }
  }
  for (const car of G.cars) {
    if (dist2(px, py, car.x, car.y) < 36 * 36) { damageCar(car, 4); return true; }
  }
  return false;
}

function updateBullets(G, dt) {
  const keep = [];
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(G.city, b.x, b.y, 0)) {
      dead = true;
      G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#f7dc6f', size: 5 });
    }
    if (!dead && b.from === 'player') {
      for (const car of G.cars) {
        if (car.isPlayer) continue;
        if (dist2(b.x, b.y, car.x, car.y) < 26 * 26) {
          dead = true;
          if (damageCar(car, 22)) { G.particles.push({ x: car.x, y: car.y, vx: 0, vy: -40, life: 0.7, max: 0.7, color: '#e74c3c', size: 10 }); }
          break;
        }
      }
      if (!dead) {
        for (const cop of G.cops) {
          if (cop.onFoot && dist2(b.x, b.y, cop.x, cop.y) < 20 * 20) {
            dead = true;
            cop.hp -= 34;
            if (cop.hp <= 0) { cop.down = true; G.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: -30, life: 0.5, max: 0.5, color: '#5dade2', size: 8 }); }
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.state !== 'down' && dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
            dead = true; ped.state = 'down'; ped.down = 5;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'cop') {
      const p = G.player;
      if (p.state === 'alive' && !p.inCar && dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
        dead = true;
        hurtPlayer(p, 9);
      } else if (p.state === 'alive' && p.inCar && dist2(b.x, b.y, p.inCar.x, p.inCar.y) < 26 * 26) {
        dead = true;
        damageCar(p.inCar, 6);
      }
    }
    if (!dead) keep.push(b);
  }
  G.bullets = keep;
}
