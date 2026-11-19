// police.js — the wanted system. Stars rise when the player commits crimes
// in view of the law and fall when the player breaks line of sight and stays
// quiet. Pursuit cars ram the player's car; foot officers chase and shoot at
// three stars and up. Getting caught on foot at low speed means busted.

function makeCops() { return []; }

function raiseWanted(G, stars) {
  G.wanted = clamp(G.wanted + stars, 0, 5);
  G.wantedHeat = 6; // seconds before the level can start cooling
  G.lastCrime = G.time;
}

function wantedLabel(stars) {
  return ['Clean', 'Suspicious', 'Pursued', 'Hunted', 'Manhunt', 'City Lockdown'][stars];
}

function spawnCopCar(G, x, y) {
  const car = makeCar(x, y, 0, { color: '#1c2833', isCop: true, hp: 120 });
  car.cruise = 300;
  G.cars.push(car);
  G.cops.push({ car, onFoot: false, hp: 100, x, y, angle: 0, shootCooldown: 1 + Math.random(), down: false, foot: null });
  return car;
}

function spawnCopFoot(G, x, y) {
  G.cops.push({ car: null, onFoot: true, hp: 100, x, y, angle: 0, shootCooldown: 1 + Math.random(), down: false, foot: { speed: 165 } });
}

// How many cop units the current wanted level calls for.
function copsWanted(stars) {
  if (stars <= 0) return 0;
  if (stars === 1) return 1;
  if (stars === 2) return 2;
  if (stars === 3) return 3;
  if (stars === 4) return 5;
  return 7;
}

function updatePolice(G, dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  // Cooling: no crime for a while and no cop nearby -> stars bleed off.
  if (G.wanted > 0) {
    G.wantedHeat -= dt;
    let nearest = Infinity;
    for (const cop of G.cops) {
      if (cop.down) continue;
      const cx = cop.onFoot ? cop.x : cop.car.x;
      const cy = cop.onFoot ? cop.y : cop.car.y;
      nearest = Math.min(nearest, dist2(px, py, cx, cy));
    }
    if (G.wantedHeat <= 0 && nearest > 520 * 520) {
      G.wantedCool = (G.wantedCool || 0) + dt;
      if (G.wantedCool > 4) { G.wanted--; G.wantedCool = 0; G.wantedHeat = 3; }
    } else {
      G.wantedCool = 0;
    }
  }

  // Reinforcements arrive until the street has what the stars demand.
  const active = G.cops.filter(c => !c.down).length;
  const need = copsWanted(G.wanted);
  if (active < need) {
    const edge = randomRoadPoint(Math.random);
    // Spawn off-screen but near the player, on a road.
    const sx = clamp(px + (Math.random() < 0.5 ? -1 : 1) * 700, 80, WORLD_W - 80);
    const sy = clamp(py + (Math.random() < 0.5 ? -1 : 1) * 500, 80, WORLD_H - 80);
    const spot = snapToRoad(sx, sy);
    if (G.wanted >= 3 && Math.random() < 0.4) spawnCopFoot(G, spot.x, spot.y);
    else spawnCopCar(G, spot.x, spot.y);
    void edge;
  }

  // No heat, no hunt: units far from the player stand down and despawn.
  if (G.wanted === 0) {
    for (const cop of G.cops) {
      if (cop.down) continue;
      const cx = cop.onFoot ? cop.x : cop.car.x;
      const cy = cop.onFoot ? cop.y : cop.car.y;
      if (dist2(px, py, cx, cy) > 700 * 700) cop.down = true;
    }
  }

  // Each unit hunts the player.
  for (const cop of G.cops) {
    if (cop.down) continue;
    if (cop.onFoot) {
      const dx = px - cop.x, dy = py - cop.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 26) {
        cop.angle = Math.atan2(dy, dx);
        const sp = cop.foot.speed;
        cop.x += Math.cos(cop.angle) * sp * dt;
        cop.y += Math.sin(cop.angle) * sp * dt;
      }
      cop.shootCooldown -= dt;
      if (G.wanted >= 3 && d < 420 && cop.shootCooldown <= 0) {
        cop.shootCooldown = 1.1 + Math.random() * 0.7;
        fireCopBullet(G, cop, px, py);
      }
      // Busted: an officer in contact with a dawdling player on foot, held
      // for a moment — a brush in passing does not end the run.
      if (!p.inCar && d < 24 && Math.abs(p.speed) < 60) G.touchingCop = true;
    } else {
      const car = cop.car;
      if (!car || car.hp <= 0) { cop.down = true; continue; }
      const dx = px - car.x, dy = py - car.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const want = Math.atan2(dy, dx);
      car.angle = angleLerp(car.angle, want, clamp(3.5 * dt, 0, 1));
      car.speed = lerp(car.speed, d > 120 ? 330 : 180, clamp(1.6 * dt, 0, 1));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Ram the player's car.
      if (p.inCar && d < 44) {
        damageCar(p.inCar, 14);
        car.speed *= 0.4;
        AudioSys.crash();
        G.particles.push({ x: px, y: py, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#f39c12', size: 8 });
        if (p.inCar.hp <= 0) {
          G.particles.push({ x: px, y: py, vx: 0, vy: -50, life: 0.8, max: 0.8, color: '#e74c3c', size: 14 });
          exitCar(p);
        }
      }
    }
  }

  // Held contact with an officer on foot busts the player.
  if (G.touchingCop) {
    G.bustedTimer = (G.bustedTimer || 0) + dt;
    if (G.bustedTimer > 1.2 && p.state === 'alive') { p.state = 'busted'; AudioSys.busted(); }
  } else {
    G.bustedTimer = 0;
  }
  G.touchingCop = false;

  // Cleanup: a wrecked pursuit car becomes a parked wreck, a downed officer
  // and any unit left far behind once the heat is gone simply despawn.
  const alive = [];
  for (const cop of G.cops) {
    if (cop.down) {
      if (cop.car && cop.car.hp <= 0) { cop.car.isCop = false; cop.car.isTraffic = false; }
      if (cop.car && cop.car.hp > 0 && G.wanted === 0) {
        G.cars = G.cars.filter(c => c !== cop.car);
      }
      continue;
    }
    alive.push(cop);
  }
  G.cops = alive;
}
