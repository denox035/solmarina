// peds.js — pedestrians. They stroll the sidewalks, cross at junctions,
// and run away from gunfire and speeding cars. Only the PLAYER's actions
// raise the wanted level: a traffic car hitting a pedestrian is the
// traffic's fault, never the player's.

const PED_SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22', '#95a5a6'];
const PED_NAMES = ['Ana', 'Beto', 'Celia', 'Dario', 'Elsa', 'Felix', 'Greta', 'Hugo', 'Ines', 'Jorge', 'Kira', 'Leo', 'Mina', 'Nico'];

let pedSeq = 0;
function makePed(x, y) {
  pedSeq++;
  return {
    id: pedSeq,
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 28 + Math.random() * 30,
    shirt: PED_SHIRTS[pedSeq % PED_SHIRTS.length],
    name: PED_NAMES[pedSeq % PED_NAMES.length],
    state: 'walk', // walk | flee | down
    target: null,
    panic: 0,
    down: 0,
  };
}

function spawnPeds(count, city) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(Math.random);
    // Keep pedestrians on the sidewalk, just off the road centre.
    p.x += (Math.random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12 + Math.random() * 30);
    list.push(makePed(clamp(p.x, 60, WORLD_W - 60), clamp(p.y, 60, WORLD_H - 60)));
  }
  return list;
}

function updatePed(ped, dt, city, danger) {
  if (ped.state === 'down') {
    ped.down -= dt;
    if (ped.down <= 0) { ped.state = 'walk'; ped.panic = 0; }
    return;
  }
  if (danger && dist2(ped.x, ped.y, danger.x, danger.y) < 220 * 220) {
    ped.state = 'flee';
    ped.panic = 2.5;
  }
  if (ped.state === 'flee') {
    ped.panic -= dt;
    const away = Math.atan2(ped.y - (danger ? danger.y : ped.y), ped.x - (danger ? danger.x : ped.x));
    ped.angle = angleLerp(ped.angle, away, clamp(6 * dt, 0, 1));
    ped.x += Math.cos(ped.angle) * 150 * dt;
    ped.y += Math.sin(ped.angle) * 150 * dt;
    if (ped.panic <= 0) ped.state = 'walk';
  } else {
    if (!ped.target) ped.target = randomRoadPoint(Math.random);
    const dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 20) { ped.target = randomRoadPoint(Math.random); return; }
    ped.angle = angleLerp(ped.angle, Math.atan2(dy, dx), clamp(4 * dt, 0, 1));
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.x = clamp(ped.x, 50, WORLD_W - 50);
  ped.y = clamp(ped.y, 50, WORLD_H - 50);
  if (pointInBuilding(city, ped.x, ped.y, 4)) {
    ped.x -= Math.cos(ped.angle) * ped.speed * dt * 2;
    ped.y -= Math.sin(ped.angle) * ped.speed * dt * 2;
    ped.target = randomRoadPoint(Math.random);
  }
}

// A pedestrian hit by a moving car goes down. Returns 'player' if the
// player's car did it, 'traffic' if a traffic car did it, null otherwise.
function pedHitByCar(ped, cars) {
  if (ped.state === 'down') return null;
  for (const car of cars) {
    if (Math.abs(car.speed) < 40) continue;
    if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26) {
      ped.state = 'down';
      ped.down = 4;
      return car.isPlayer ? 'player' : 'traffic';
    }
  }
  return null;
}
