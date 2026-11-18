// player.js — on-foot movement, combat stance, stealing, health, cash.
import { buildingAt, clampToWorld, inWater, WORLD } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: 100, maxHp: 100, cash: 50,
    inCar: null,            // car object when driving
    weapon: 'fists', ammo: 0,
    sprint: false, moving: false,
    punchCd: 0, shootCd: 0, hurtCd: 0,
    hidden: false,         // hidden from police (in park / far away)
  };
}

export function updatePlayer(G, dt) {
  const p = G.player, keys = G.keys;
  if (p.inCar) return; // driving is handled by vehicles.js
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  let dx = 0, dy = 0;
  if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
  p.moving = dx !== 0 || dy !== 0;
  p.sprint = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  const speed = p.sprint ? 235 : 150;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    const nx = p.x + (dx / len) * speed * dt;
    const ny = p.y + (dy / len) * speed * dt;
    // Collide with buildings and water (can't swim, can't walk through walls).
    if (!buildingAt(G.city, nx, p.y) && !inWater(G.city, nx, p.y)) p.x = nx;
    if (!buildingAt(G.city, p.x, ny) && !inWater(G.city, p.x, ny)) p.y = ny;
    const c = clampToWorld(p.x, p.y); p.x = c.x; p.y = c.y;
  }
  // Face the mouse (aim direction) while on foot.
  const m = G.mouse;
  if (m.active) p.angle = Math.atan2(m.worldY - p.y, m.worldX - p.x);
  else if (p.moving) p.angle = Math.atan2(dy, dx);
  // Hidden: standing in a park block or deep on the beach, far from any cop.
  p.hidden = false;
  for (const b of G.city.buildings) {
    if (b.kind === 'park' && p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) { p.hidden = true; break; }
  }
  // Slow health regen when calm (no wanted, not recently hurt).
  if (G.wanted === 0 && p.hurtCd <= 0 && p.hp > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2.5 * dt);
}

export function hurtPlayer(G, dmg, source) {
  const p = G.player;
  if (p.hp <= 0 || p.hurtCd > 0) return;
  p.hp -= dmg;
  p.hurtCd = 0.35;
  G.audio.noise(0.12, 0.25, 400);
  if (p.hp <= 0) {
    p.hp = 0;
    G.state = 'dead';
    G.stats.deaths++;
    G.audio.missionFail();
    G.msg = source === 'arrest' ? 'BUSTED by the Solmarina PD!' : 'WASTED — the streets of Solmarina are unforgiving.';
  }
}

export function addCash(G, amount, reason) {
  G.player.cash += amount;
  G.audio.cash();
  G.floaters.push({ x: G.player.x, y: G.player.y - 24, text: `+$${amount} ${reason || ''}`, t: 0, color: '#7dff8a' });
  if (amount >= 500) G.msg = `Payday: +$${amount} — ${reason || 'job done'}.`;
}

export function nearestStealableCar(G, maxDist = 46) {
  const p = G.player;
  let best = null, bd = maxDist;
  for (const c of G.cars) {
    if (c.ai === 'traffic' || c.wrecked) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function tryStealCar(G) {
  const p = G.player;
  if (p.inCar) { // exit the car
    const car = p.inCar;
    p.inCar = null;
    car.player = false;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    p.angle = car.angle;
    return 'exit';
  }
  const car = nearestStealableCar(G);
  if (!car) return null;
  p.inCar = car;
  car.player = true; car.ai = null; car.parked = false;
  G.stats.carsStolen++;
  G.audio.pickup();
  if (car.owner === 'civilian') {
    G.wanted = Math.max(G.wanted, 1);
    G.wantedTimer = 0;
    G.msg = 'Car stolen in broad daylight — the PD has been called!';
  } else {
    G.msg = 'You took the car. Engine purrs like a marina cat.';
  }
  return 'steal';
}
