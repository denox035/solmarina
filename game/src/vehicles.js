// vehicles.js — cars: arcade physics for the player, road-graph traffic AI
// for everyone else. A car is a rectangle with heading, speed and health;
// traffic cars pick a random next intersection at every junction.

const CAR_COLORS = ['#c0392b', '#2e86c1', '#f1c40f', '#e67e22', '#8e44ad', '#1abc9c', '#ecf0f1', '#2c3e50', '#d35400', '#16a085'];
const CAR_NAMES = ['Comet', 'Vagabond', 'Sunrunner', 'Marlin', 'Duchess', 'Prowler', 'Cortez', 'Banshee', 'Lowrider', 'Falcon'];

let carSeq = 0;
function makeCar(x, y, angle, opts) {
  const o = opts || {};
  carSeq++;
  return {
    id: carSeq,
    x, y, angle: angle || 0,
    speed: 0,
    w: 44, h: 22,
    color: o.color || CAR_COLORS[carSeq % CAR_COLORS.length],
    name: o.name || CAR_NAMES[carSeq % CAR_NAMES.length],
    hp: o.hp || 100,
    isPlayer: !!o.isPlayer,
    isCop: !!o.isCop,
    isTraffic: !o.isPlayer && !o.isCop,
    // Traffic AI state:
    target: null,
    cruise: 90 + Math.random() * 60,
    stuck: 0,
    smoke: 0,
  };
}

// Arcade driving: throttle accelerates along the heading, steering turns
// harder at low speed, reverse is capped, off-road drag is heavy.
function driveCar(car, input, dt, onRoad) {
  const accel = 340, brake = 520, maxFwd = 460, maxRev = 160;
  if (input.up) car.speed += accel * dt;
  if (input.down) car.speed -= (car.speed > 0 ? brake : accel * 0.6) * dt;
  if (!input.up && !input.down) car.speed -= car.speed * 0.9 * dt;
  if (!onRoad) car.speed -= car.speed * 1.6 * dt; // sand and grass drag
  car.speed = clamp(car.speed, -maxRev, maxFwd);
  if (Math.abs(car.speed) < 2) car.speed = 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.4 * dir * clamp(Math.abs(car.speed) / 160, 0, 1) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, WORLD_W - 40);
  car.y = clamp(car.y, 40, WORLD_H - 40);
}

// Simple circle-vs-rectangle car collision, pushes both apart and swaps a
// little speed so crashes feel physical without a physics engine.
function collideCars(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const min = 34;
  if (d === 0 || d > min) return 0;
  const push = (min - d) / 2;
  const nx = dx / d, ny = dy / d;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed) + 40;
  const tmp = a.speed;
  a.speed = b.speed * 0.55;
  b.speed = tmp * 0.55;
  return impact;
}

function carCorners(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const hw = car.w / 2, hh = car.h / 2;
  return [
    { x: car.x + c * hw - s * hh, y: car.y + s * hw + c * hh },
    { x: car.x + c * hw + s * hh, y: car.y + s * hw - c * hh },
    { x: car.x - c * hw + s * hh, y: car.y - s * hw - c * hh },
    { x: car.x - c * hw - s * hh, y: car.y - s * hw + c * hh },
  ];
}

// Traffic: drive toward the current target intersection; at arrival pick a
// neighbouring intersection at random and keep going. Stuck cars reverse out.
function updateTraffic(car, dt, city) {
  if (!car.target) car.target = pickNextIntersection(car, city);
  const dx = car.target.x - car.x, dy = car.target.y - car.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 26) { car.target = pickNextIntersection(car, city); return; }
  const want = Math.atan2(dy, dx);
  car.angle = angleLerp(car.angle, want, clamp(3.2 * dt, 0, 1));
  const align = Math.cos(want - car.angle);
  if (align > 0.4) car.speed = lerp(car.speed, car.cruise, clamp(1.4 * dt, 0, 1));
  else car.speed = lerp(car.speed, 0, clamp(3 * dt, 0, 1));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (pointInBuilding(city, car.x, car.y, 8)) {
    // Bumped a wall: back up and pick a new heading.
    car.x -= Math.cos(car.angle) * car.speed * dt * 2;
    car.y -= Math.sin(car.angle) * car.speed * dt * 2;
    car.speed = -60;
    car.stuck += dt;
    if (car.stuck > 1.2) { car.target = pickNextIntersection(car, city); car.stuck = 0; }
  }
}

function pickNextIntersection(car, city) {
  const options = [];
  const ax = nearestAvenue(car.x), sy = nearestStreet(car.y);
  // From the current road, the next stop is a junction on a crossing road.
  if (Math.abs(car.x - ax) < Math.abs(car.y - sy)) {
    for (const s of STREETS) options.push({ x: ax, y: s });
  } else {
    for (const a of AVENUES) options.push({ x: a, y: sy });
  }
  // Sometimes jump to a far junction so traffic spreads over the city.
  if (Math.random() < 0.25) return { x: AVENUES[Math.floor(Math.random() * AVENUES.length)], y: STREETS[Math.floor(Math.random() * STREETS.length)] };
  const t = options[Math.floor(Math.random() * options.length)];
  if (dist2(t.x, t.y, car.x, car.y) < 60) return randomRoadPoint(Math.random);
  return t;
}

function damageCar(car, amount) {
  car.hp -= amount;
  if (car.hp < 35) car.smoke = 1;
  if (car.hp <= 0) { car.hp = 0; car.speed = 0; }
  return car.hp <= 0;
}
