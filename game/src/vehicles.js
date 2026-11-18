// vehicles.js — player driving + traffic AI + parked cars.
import { buildingAt, clampToWorld, inWater, nearestRoadCoord, onRoad, randomRoadPoint } from './city.js';

const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e8c84a', '#4ad88a', '#b06ad8', '#e8e8e8', '#3a3f4a', '#e08a3a', '#7ad8d8'];
const CAR_NAMES = ['Comet', 'Viento', 'Marlin', 'Duna', 'Palmera', 'Coral GT', 'Brisa', 'Tiburon'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    name: opts.name || CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)],
    ai: opts.ai || null,          // 'traffic' | 'police' | 'mission' | null (parked/player)
    parked: !!opts.parked, owner: opts.owner || 'civilian',
    player: false, wrecked: false, hp: 100,
    target: null,                 // traffic waypoint {x,y}
    dir: opts.dir || 0,           // traffic travel direction (0=E,1=S,2=W,3=N)
    wait: 0, honk: 0,
  };
}

export function spawnParkedCars(G, count = 26) {
  const spots = G.city.parkSpots;
  for (let i = 0; i < count && i < spots.length; i++) {
    const s = spots[(i * 3 + 1) % spots.length];
    const c = makeCar(s.x, s.y, s.angle, { parked: true });
    G.cars.push(c);
  }
}

export function spawnTraffic(G, count = 16) {
  const rnd = G.rnd;
  for (let i = 0; i < count; i++) {
    const pt = randomRoadPoint(G.city, rnd);
    // Never spawn traffic on top of the player.
    if (Math.hypot(pt.x - G.player.x, pt.y - G.player.y) < 260) continue;
    const vertical = Math.abs(pt.x - nearestRoadCoord(G.city, pt.x)) < 2;
    const dir = vertical ? (rnd() < 0.5 ? 1 : 3) : (rnd() < 0.5 ? 0 : 2);
    const lane = 15; // right-hand lane offset
    const c = makeCar(
      pt.x + (vertical ? (dir === 1 ? lane : -lane) : 0),
      pt.y + (vertical ? 0 : (dir === 0 ? lane : -lane)),
      [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir],
      { ai: 'traffic', dir },
    );
    c.speed = 90 + rnd() * 60;
    c.target = nextWaypoint(G, c);
    G.cars.push(c);
  }
}

function nextWaypoint(G, car) {
  // Traffic drives along its road to the next intersection, then may turn.
  const step = 300;
  const dx = [1, 0, -1, 0][car.dir], dy = [0, 1, 0, -1][car.dir];
  let nx = car.x + dx * step, ny = car.y + dy * step;
  if (nx < 220 || nx > 3060 || ny < 220 || ny > 3060) {
    car.dir = (car.dir + 2) % 4; // U-turn at the edge of the grid
    return { x: car.x - dx * step, y: car.y - dy * step };
  }
  // At an intersection, sometimes turn left/right.
  const nearX = nearestRoadCoord(G.city, nx), nearY = nearestRoadCoord(G.city, ny);
  const atCross = Math.abs(nx - nearX) < 20 && Math.abs(ny - nearY) < 20;
  if (atCross && G.rnd() < 0.45) {
    car.dir = (car.dir + (G.rnd() < 0.5 ? 1 : 3)) % 4;
    const d2x = [1, 0, -1, 0][car.dir], d2y = [0, 1, 0, -1][car.dir];
    return { x: car.x + d2x * step, y: car.y + d2y * step };
  }
  return { x: nx, y: ny };
}

function carAhead(G, car, dist = 70) {
  const fx = car.x + Math.cos(car.angle) * dist, fy = car.y + Math.sin(car.angle) * dist;
  for (const o of G.cars) {
    if (o === car || o.wrecked) continue;
    if (Math.hypot(o.x - fx, o.y - fy) < 34) return o;
  }
  // Player on foot in front of a traffic car makes it brake.
  if (!car.player && G.player.inCar !== car) {
    if (Math.hypot(G.player.x - fx, G.player.y - fy) < 26) return 'ped';
  }
  return null;
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.wrecked) continue;
    if (car.player) { updatePlayerCar(G, car, dt); continue; }
    if (car.ai === 'traffic') updateTraffic(G, car, dt);
    else if (car.ai === 'police') { /* police.js drives cop cars */ }
    else if (car.ai === 'mission') { /* missions.js drives target cars */ }
    else if (car.parked) { /* stays put */ }
  }
  // Remove traffic that drifted off the map, keep the count topped up.
  if (G.cars.filter(c => c.ai === 'traffic').length < 12 && G.state === 'play') {
    spawnTraffic(G, 1);
  }
}

function updatePlayerCar(G, car, dt) {
  const keys = G.keys;
  const accel = (keys['KeyW'] || keys['ArrowUp']) ? 1 : 0;
  const brake = (keys['KeyS'] || keys['ArrowDown']) ? 1 : 0;
  const steer = ((keys['KeyA'] || keys['ArrowLeft']) ? -1 : 0) + ((keys['KeyD'] || keys['ArrowRight']) ? 1 : 0);
  const maxSpeed = 430, maxReverse = 140;
  if (accel) car.speed += 300 * dt;
  else if (brake) car.speed -= car.speed > 5 ? 420 * dt : 160 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
  if (Math.abs(car.speed) > 4) {
    car.angle += steer * 1.9 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const b = buildingAt(G.city, nx, ny);
  if (b || inWater(G.city, nx, ny)) {
    // Crash: bounce back, damage the car, shake the camera.
    if (Math.abs(car.speed) > 120) {
      G.audio.crash();
      G.shake = Math.min(14, Math.abs(car.speed) / 30);
      car.hp -= Math.abs(car.speed) / 14;
      if (car.hp <= 0) { car.wrecked = true; G.msg = 'Your ride is wrecked. Find another one.'; }
    }
    car.speed *= -0.35;
  } else {
    car.x = nx; car.y = ny;
  }
  const c = clampToWorld(car.x, car.y); car.x = c.x; car.y = c.y;
  // Soft collision with other cars.
  for (const o of G.cars) {
    if (o === car || o.wrecked) continue;
    const d = Math.hypot(o.x - car.x, o.y - car.y);
    if (d < 40 && d > 0.01) {
      const push = (40 - d) / 2;
      const ux = (car.x - o.x) / d, uy = (car.y - o.y) / d;
      car.x += ux * push; car.y += uy * push;
      if (!o.player && o.ai === 'traffic') { o.x -= ux * push; o.y -= uy * push; }
      if (Math.abs(car.speed) > 160) { G.audio.crash(); G.shake = 8; }
      car.speed *= 0.82;
    }
  }
  // Player position follows the car.
  G.player.x = car.x; G.player.y = car.y; G.player.angle = car.angle;
  G.audio.setEngine(Math.abs(car.speed) / maxSpeed, true);
}

function updateTraffic(G, car, dt) {
  if (!car.target) car.target = nextWaypoint(G, car);
  const tx = car.target.x - car.x, ty = car.target.y - car.y;
  const dist = Math.hypot(tx, ty);
  if (dist < 26) { car.target = nextWaypoint(G, car); return; }
  const wantAngle = Math.atan2(ty, tx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const blocked = carAhead(G, car);
  const cruise = blocked ? 0 : 110 + (car.speed % 40);
  car.speed += (cruise - car.speed) * Math.min(1, 1.6 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!buildingAt(G.city, nx, ny) && !inWater(G.city, nx, ny) && onRoad(G.city, nx, ny)) {
    car.x = nx; car.y = ny;
  } else {
    car.target = nextWaypoint(G, car); // got stuck: pick a new route
  }
}
