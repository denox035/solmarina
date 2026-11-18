// peds.js — pedestrians strolling the sidewalks, fleeing from gunfire and sirens.
import { buildingAt, clampToWorld, inWater, onSidewalk, randomRoadPoint } from './city.js';

const SHIRTS = ['#e84a6a', '#4a9ad8', '#e8a84a', '#6ad88a', '#d86ad8', '#e8e8e8', '#4ad8c8', '#d84a4a'];
const PANTS = ['#2a3040', '#4a3a2a', '#3a4a5a', '#5a2a3a'];

export function makePed(G, x, y) {
  return {
    x, y, angle: Math.random() * Math.PI * 2,
    speed: 28 + G.rnd() * 26, target: null,
    shirt: SHIRTS[Math.floor(G.rnd() * SHIRTS.length)],
    pants: PANTS[Math.floor(G.rnd() * PANTS.length)],
    flee: 0, walkPhase: G.rnd() * 10, scared: false,
  };
}

export function spawnPeds(G, count = 26) {
  for (let i = 0; i < count; i++) {
    const pt = randomRoadPoint(G.city, G.rnd);
    // Nudge onto the sidewalk beside the road.
    const vertical = Math.abs(pt.x - 200) % 300 < 150;
    const p = makePed(G, pt.x + (vertical ? 44 : 0), pt.y + (vertical ? 0 : 44));
    p.target = randomRoadPoint(G.city, G.rnd);
    G.peds.push(p);
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    ped.walkPhase += dt * 6;
    // Flee if the player shoots, speeds nearby, or a siren is close.
    const dPlayer = Math.hypot(ped.x - p.x, ped.y - p.y);
    const gunfire = G.stats.shotsFiredAt > G.time - 1.2;
    if ((gunfire && dPlayer < 320) || (p.inCar && Math.abs(p.inCar.speed) > 200 && dPlayer < 90)) {
      ped.flee = 2.5; ped.scared = true;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * 150 * dt;
      const ny = ped.y + Math.sin(away) * 150 * dt;
      if (!buildingAt(G.city, nx, ny) && !inWater(G.city, nx, ny)) { ped.x = nx; ped.y = ny; }
      continue;
    }
    ped.scared = false;
    if (!ped.target) ped.target = randomRoadPoint(G.city, G.rnd);
    const dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) { ped.target = randomRoadPoint(G.city, G.rnd); continue; }
    const want = Math.atan2(dy, dx);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!buildingAt(G.city, nx, ny) && !inWater(G.city, nx, ny)) { ped.x = nx; ped.y = ny; }
    else ped.target = randomRoadPoint(G.city, G.rnd);
  }
  // Keep the crowd topped up.
  if (G.peds.length < 20 && G.state === 'play') {
    const pt = randomRoadPoint(G.city, G.rnd);
    const np = makePed(G, pt.x, pt.y);
    np.target = randomRoadPoint(G.city, G.rnd);
    G.peds.push(np);
  }
}
