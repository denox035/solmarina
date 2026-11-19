// player.js — Mara Voss, driver for hire. On foot she walks, punches and
// shoots; near a car she can steal it (E) and drive; she can bail out (E)
// while moving slowly. Health, cash and the busted/wasted states live here.

function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    hp: 100,
    cash: 250,
    ammo: 24,
    weapon: 'fists', // fists | pistol
    inCar: null,
    state: 'alive', // alive | busted | wasted
    punchCooldown: 0,
    shootCooldown: 0,
    invuln: 0,
  };
}

function updatePlayerOnFoot(p, input, dt, city) {
  const walk = 185;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (input.run) { mx *= 1.6; my *= 1.6; }
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 0) {
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    const nx = p.x + mx * walk * (input.run ? 1.6 : 1) * dt;
    const ny = p.y + my * walk * (input.run ? 1.6 : 1) * dt;
    if (!pointInBuilding(city, nx, p.y, 8) && !isWater(nx, p.y)) p.x = nx;
    if (!pointInBuilding(city, p.x, ny, 8) && !isWater(p.x, ny)) p.y = ny;
    p.speed = walk;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, 40, WORLD_W - 40);
  p.y = clamp(p.y, 40, WORLD_H - 40);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
}

// Find the closest car the player could steal, within reach.
function nearestStealableCar(p, cars) {
  let best = null, bd = 70 * 70;
  for (const car of cars) {
    if (car.isCop) continue;
    if (car.hp <= 0) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(p, car) {
  car.isPlayer = true;
  car.isTraffic = false;
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  return car;
}

function exitCar(p) {
  const car = p.inCar;
  if (!car) return null;
  car.isPlayer = false;
  car.isTraffic = false; // parked where the player left it
  car.speed = 0;
  const side = p.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.inCar = null;
  return car;
}

function hurtPlayer(p, amount) {
  if (p.invuln > 0 || p.state !== 'alive') return false;
  p.hp -= amount;
  p.invuln = 0.5;
  if (p.hp <= 0) { p.hp = 0; p.state = 'wasted'; return true; }
  return false;
}

function addCash(p, amount) { p.cash += amount; return p.cash; }
