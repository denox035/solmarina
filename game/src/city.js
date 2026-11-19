// city.js — Solmarina, a seeded procedural coastal city.
// The world is a 2560x1920 island grid: avenues run north-south, streets run
// east-west, a beach on the west edge, a marina in the south-east, Coral Park
// at the centre, and six named landmarks. Everything here is generated from
// one seed so the city is the same every load.

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randRange(rng, a, b) { return a + rng() * (b - a); }

const WORLD_W = 2560;
const WORLD_H = 1920;
const ROAD_W = 56;

// Avenues (vertical) and streets (horizontal) — the road grid.
const AVENUES = [320, 640, 960, 1280, 1600, 1920, 2240];
const STREETS = [240, 480, 720, 960, 1200, 1440, 1680];

const LANDMARKS = [
  { name: 'Meridian Tower', x: 1440, y: 480, w: 150, h: 110, color: '#5b7fa6', kind: 'tower' },
  { name: 'Solmarina Grand', x: 1760, y: 1200, w: 170, h: 120, color: '#b98a3e', kind: 'casino' },
  { name: 'Sunset Pier', x: 120, y: 960, w: 130, h: 46, color: '#8a6b4f', kind: 'pier' },
  { name: 'Marina Docks', x: 2160, y: 1680, w: 180, h: 90, color: '#4f7d8a', kind: 'docks' },
  { name: 'Coral Park', x: 1280, y: 840, w: 260, h: 180, color: '#4e8a4a', kind: 'park' },
  { name: 'The Shipyard', x: 480, y: 1680, w: 190, h: 100, color: '#7a6a8a', kind: 'yard' },
];

const ROOF_COLORS = ['#8a7f70', '#7d8a99', '#a67c52', '#6f7f6a', '#9a8a7a', '#5f7488'];
const WALL_COLORS = ['#c9bda6', '#b8c4cc', '#d8c49a', '#b5c2b0', '#cbb3a0', '#a8b8c4'];

function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  // One block = the rectangle between two neighbouring avenues and streets.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      // The park block stays green; the beach strip stays empty.
      if (x0 > 1050 && x0 < 1500 && y0 > 650 && y0 < 1000) continue;
      if (x1 < 260) continue;
      if (x0 > 1980 && y0 > 1480) continue; // marina water
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const w = randRange(rng, 60, Math.min(150, bw - 20));
        const h = randRange(rng, 50, Math.min(120, bh - 20));
        const x = x0 + randRange(rng, 8, Math.max(9, bw - w - 8));
        const y = y0 + randRange(rng, 8, Math.max(9, bh - h - 8));
        buildings.push({
          x, y, w, h,
          wall: pick(rng, WALL_COLORS),
          roof: pick(rng, ROOF_COLORS),
          height: 6 + Math.floor(rng() * 22),
        });
      }
    }
  }
  // Landmark buildings sit on top of the generated ones.
  for (const lm of LANDMARKS) {
    if (lm.kind === 'park' || lm.kind === 'pier' || lm.kind === 'docks') continue;
    buildings.push({ x: lm.x - lm.w / 2, y: lm.y - lm.h / 2, w: lm.w, h: lm.h, wall: lm.color, roof: '#3e4a58', height: 34, landmark: lm.name });
  }
  return { seed, buildings, avenues: AVENUES, streets: STREETS };
}

function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + 6) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2 + 6) return true;
  return false;
}

function nearestAvenue(x) {
  let best = AVENUES[0], bd = Infinity;
  for (const ax of AVENUES) { const d = Math.abs(x - ax); if (d < bd) { bd = d; best = ax; } }
  return best;
}
function nearestStreet(y) {
  let best = STREETS[0], bd = Infinity;
  for (const sy of STREETS) { const d = Math.abs(y - sy); if (d < bd) { bd = d; best = sy; } }
  return best;
}

// Snap a point onto the road network (used for spawning cars and peds).
function snapToRoad(x, y) {
  const ax = nearestAvenue(x), sy = nearestStreet(y);
  return Math.abs(x - ax) < Math.abs(y - sy) ? { x: ax, y } : { x, y: sy };
}

function randomRoadPoint(rng) {
  if (rng() < 0.5) return { x: pick(rng, AVENUES) + randRange(rng, -14, 14), y: randRange(rng, 120, WORLD_H - 120) };
  return { x: randRange(rng, 240, WORLD_W - 120), y: pick(rng, STREETS) + randRange(rng, -14, 14) };
}

function pointInBuilding(city, x, y, pad) {
  const p = pad || 0;
  for (const b of city.buildings) {
    if (x > b.x - p && x < b.x + b.w + p && y > b.y - p && y < b.y + b.h + p) return b;
  }
  return null;
}

function isWater(x, y) {
  if (x < 90) return true; // the sea, west of the beach
  if (x > 2020 && y > 1520) return true; // the marina basin
  return false;
}
function isBeach(x, y) { return x >= 90 && x < 210; }
