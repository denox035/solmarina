// police.js — wanted level (1–5 stars) + police cars and officers who chase,
// ram, shoot and arrest. Wanted decays when the player stays hidden and quiet.
import { hurtPlayer } from './player.js';
import { buildingAt, inWater, randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';

export function raiseWanted(G, stars, reason) {
  if (stars > G.wanted) {
    G.wanted = Math.min(5, stars);
    G.wantedTimer = 0;
    G.msg = reason || `Wanted level ${G.wanted} — Solmarina PD is on you!`;
  }
}

export function crimeCommitted(G, stars, reason) {
  raiseWanted(G, stars, reason);
  G.wantedTimer = 0;
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Wanted decays: 20s calm while hidden, 45s calm while visible, never below 0.
  if (G.wanted > 0) {
    G.wantedTimer += dt;
    const calmFor = p.hidden ? 20 : 45;
    const recentCrime = G.time - G.lastCrimeAt < 6;
    if (!recentCrime && G.wantedTimer > calmFor) {
      G.wanted--;
      G.wantedTimer = 0;
      G.msg = G.wanted === 0 ? 'You lost them. The heat is off — for now.' : `Heat cooling… wanted level ${G.wanted}.`;
      if (G.wanted === 0) G.audio.setSiren(false);
    }
  }
  // Desired police presence scales with stars.
  const wantCars = G.wanted >= 4 ? 3 : G.wanted >= 2 ? 2 : G.wanted >= 1 ? 1 : 0;
  const wantPeds = G.wanted >= 3 ? 2 : G.wanted >= 1 ? 1 : 0;
  const copCars = G.cops.filter(c => c.kind === 'car');
  const copPeds = G.cops.filter(c => c.kind === 'ped');
  if (copCars.length < wantCars && G.state === 'play') spawnCopCar(G);
  if (copPeds.length < wantPeds && G.state === 'play') spawnCopPed(G);
  // Siren audio while any cop car is active.
  G.audio.setSiren(copCars.length > 0 && G.wanted > 0);
  for (const cop of G.cops) {
    if (cop.kind === 'car') updateCopCar(G, cop, dt);
    else updateCopPed(G, cop, dt);
  }
  // Despawn cops far away once the heat is off.
  if (G.wanted === 0) {
    G.cops = G.cops.filter(c => Math.hypot(c.x - p.x, c.y - p.y) < 500);
  }
}

function spawnCopCar(G) {
  const p = G.player;
  const a = G.rnd() * Math.PI * 2;
  const x = p.x + Math.cos(a) * 700, y = p.y + Math.sin(a) * 700;
  const car = makeCar(x, y, 0, { ai: 'police', color: '#1a1a2e', name: 'Interceptor' });
  car.kind = 'car'; car.hp = 120;
  G.cars.push(car);
  G.cops.push(car);
}

function spawnCopPed(G) {
  const p = G.player;
  const a = G.rnd() * Math.PI * 2;
  const cop = {
    kind: 'ped', x: p.x + Math.cos(a) * 320, y: p.y + Math.sin(a) * 320,
    angle: 0, speed: 165, shootCd: 1 + G.rnd(), hp: 50,
  };
  G.cops.push(cop);
}

function updateCopCar(G, car, dt) {
  const p = G.player;
  const dx = p.x - car.x, dy = p.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
  // Ram speed: faster at higher wanted levels, but they back off to re-aim.
  const target = d > 60 ? 300 + G.wanted * 26 : 140;
  car.speed += (target - car.speed) * Math.min(1, 2 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!buildingAt(G.city, nx, ny) && !inWater(G.city, nx, ny)) { car.x = nx; car.y = ny; }
  else { car.angle += Math.PI / 2 * dt * 4; car.speed *= 0.6; }
  // Ram the player's car or the player on foot. Damage is per-second while in contact.
  if (d < 44) {
    if (p.inCar) {
      p.inCar.hp -= 22 * dt;
      G.shake = 7;
      if (p.inCar.hp <= 0) { p.inCar.wrecked = true; p.inCar = null; G.msg = 'Your car was wrecked by the PD!'; }
    } else {
      hurtPlayer(G, 10 * dt, 'ram');
    }
    car.speed *= 0.5;
  }
  // Cops shoot at the player from range at 3+ stars.
  if (G.wanted >= 3 && d < 420 && d > 70) {
    car.shootCd = (car.shootCd || 1) - dt;
    if (car.shootCd <= 0) {
      car.shootCd = 0.9;
      G.bullets.push({
        x: car.x, y: car.y, angle: want + (G.rnd() - 0.5) * 0.2,
        speed: 620, life: 0.9, from: 'cop', dmg: 6,
      });
      G.audio.shot();
    }
  }
}

function updateCopPed(G, cop, dt) {
  const p = G.player;
  const dx = p.x - cop.x, dy = p.y - cop.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  cop.angle = Math.atan2(dy, dx);
  // Arrest: a cop who reaches a weak player on foot busts them.
  if (d < 30 && !p.inCar) {
    if (p.hp < 35) {
      hurtPlayer(G, 999, 'arrest');
      G.audio.arrest();
      return;
    }
    hurtPlayer(G, 8 * dt * 4, 'arrest');
    return;
  }
  // Chase on foot; shoot from mid-range.
  if (d > 60) {
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!buildingAt(G.city, nx, ny) && !inWater(G.city, nx, ny)) { cop.x = nx; cop.y = ny; }
  }
  cop.shootCd -= dt;
  if (d < 380 && cop.shootCd <= 0) {
    cop.shootCd = 1.1;
    G.bullets.push({
      x: cop.x, y: cop.y, angle: cop.angle + (G.rnd() - 0.5) * 0.16,
      speed: 620, life: 0.9, from: 'cop', dmg: 5,
    });
    G.audio.shot();
  }
}
