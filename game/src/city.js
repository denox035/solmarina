// city.js — procedural Solmarina: road grid, blocks, buildings, beach, marina.
// All geometry is generated from a seeded RNG so the map is identical every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD = 3400;          // world is WORLD x WORLD px
export const ROAD = 64;             // road width
export const BLOCK = 300;           // block pitch (road centre to road centre)
export const BEACH_Y = 2960;        // sand starts here (south edge)
export const MARINA_X = 2960;       // docks start here (east edge)

export function buildCity(seed = 20261118) {
  const rnd = mulberry32(seed);
  // Road centre lines: grid from 200 to 3000 step BLOCK.
  const roadsX = [], roadsY = [];
  for (let v = 200; v <= 3000; v += BLOCK) { roadsX.push(v); roadsY.push(v); }
  const roadNames = [
    'Palma Ave', 'Coral St', 'Sol Blvd', 'Marina Rd', 'Luna St',
    'Vista Way', 'Palm Row', 'Harbor Ln', 'Calle Sol', 'Breeze Ave',
  ];
  const buildings = [];
  const palettes = [
    ['#e8b48a', '#d99a6c', '#c98a5e'], ['#f2d8a7', '#e5c184', '#d9b06e'],
    ['#a8c8d8', '#8fb4c8', '#7ba3b8'], ['#d8a8b0', '#c8909c', '#b87a88'],
    ['#b8d8a8', '#a0c890', '#88b878'], ['#e8e0d0', '#d8cdb8', '#c8bda2'],
  ];
  const kinds = ['apartments', 'shop', 'office', 'hotel', 'cafe', 'warehouse'];
  // One building per block interior (between roads), skipping beach/marina strips.
  for (let ix = 0; ix < roadsX.length - 1; ix++) {
    for (let iy = 0; iy < roadsY.length - 1; iy++) {
      const x0 = roadsX[ix] + ROAD / 2 + 14, y0 = roadsY[iy] + ROAD / 2 + 14;
      const x1 = roadsX[ix + 1] - ROAD / 2 - 14, y1 = roadsY[iy + 1] - ROAD / 2 - 14;
      if (y0 > BEACH_Y - 40 || x0 > MARINA_X - 40) continue; // beach / marina strips stay open
      if (rnd() < 0.12) { // park / plaza instead of a building (also a police hiding spot)
        buildings.push({ kind: 'park', x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: 3 + Math.floor(rnd() * 4), benches: 2 + Math.floor(rnd() * 3) });
        continue;
      }
      const w = 60 + rnd() * (x1 - x0 - 90), h = 60 + rnd() * (y1 - y0 - 90);
      const bx = x0 + rnd() * (x1 - x0 - w), by = y0 + rnd() * (y1 - y0 - h);
      const pal = palettes[Math.floor(rnd() * palettes.length)];
      buildings.push({
        kind: kinds[Math.floor(rnd() * kinds.length)], x: bx, y: by, w, h,
        color: pal[Math.floor(rnd() * pal.length)], roof: pal[0],
        floors: 1 + Math.floor(rnd() * 5), seed: rnd(),
      });
    }
  }
  // Beach props: umbrellas + towels on the sand strip.
  const beachProps = [];
  for (let i = 0; i < 26; i++) {
    beachProps.push({ x: 120 + rnd() * (WORLD - 300), y: BEACH_Y + 30 + rnd() * 180, hue: rnd() });
  }
  // Marina: docks jutting into the water + moored boats.
  const docks = [];
  for (let i = 0; i < 5; i++) {
    const y = 420 + i * 480;
    docks.push({ x: MARINA_X, y, len: 260, boats: 2 + Math.floor(rnd() * 3) });
  }
  const boats = [];
  for (const d of docks) for (let b = 0; b < d.boats; b++) {
    boats.push({ x: d.x + 60 + b * 70, y: d.y + (b % 2 ? 26 : -26), angle: (rnd() - 0.5) * 0.3, color: ['#f2f2f2', '#d84a4a', '#4a7ad8', '#e8c84a'][b % 4] });
  }
  // Landmarks (named, used by missions + minimap).
  const landmarks = {
    hideout: { x: 500, y: 500, name: 'Hideout — Casa Alba' },
    bank: { x: 2300, y: 1100, name: 'Banco del Sol' },
    marina: { x: 3050, y: 1500, name: 'Marina Solmarina' },
    beach: { x: 1700, y: 3150, name: 'Playa Dorada' },
    garage: { x: 1100, y: 2300, name: "Rico's Garage" },
    pier: { x: 3200, y: 2600, name: 'Old Pier' },
    market: { x: 1700, y: 1700, name: 'Mercado Central' },
    hotel: { x: 2600, y: 2600, name: 'Hotel Miramar' },
  };
  // Parked-car spawn spots: along road edges, off the driving lane.
  const parkSpots = [];
  for (let i = 0; i < 90; i++) {
    const vertical = rnd() < 0.5;
    const road = vertical ? roadsX[Math.floor(rnd() * roadsX.length)] : roadsY[Math.floor(rnd() * roadsY.length)];
    const along = 260 + rnd() * (WORLD - 560);
    const side = rnd() < 0.5 ? -1 : 1;
    parkSpots.push({
      x: vertical ? road + side * (ROAD / 2 - 12) : along,
      y: vertical ? along : road + side * (ROAD / 2 - 12),
      angle: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
    });
  }
  return { roadsX, roadsY, roadNames, buildings, beachProps, docks, boats, landmarks, parkSpots, rnd };
}

// ---- geometry helpers used by every other module ----
export function nearestRoadCoord(city, v) {
  let best = city.roadsX[0], bd = Infinity;
  for (const r of city.roadsX) { const d = Math.abs(r - v); if (d < bd) { bd = d; best = r; } }
  return best;
}
export function onRoad(city, x, y) {
  for (const r of city.roadsX) if (Math.abs(x - r) < ROAD / 2 + 4) return true;
  for (const r of city.roadsY) if (Math.abs(y - r) < ROAD / 2 + 4) return true;
  return false;
}
export function onSidewalk(city, x, y) {
  if (x > MARINA_X || y > BEACH_Y) return false;
  for (const r of city.roadsX) if (Math.abs(Math.abs(x - r) - (ROAD / 2 + 10)) < 10) return true;
  for (const r of city.roadsY) if (Math.abs(Math.abs(y - r) - (ROAD / 2 + 10)) < 10) return true;
  return false;
}
export function inWater(city, x, y) {
  return y > BEACH_Y + 240 || x > MARINA_X + 300;
}
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (b.kind === 'park') continue;
    if (x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4) return b;
  }
  return null;
}
export function clampToWorld(x, y) {
  return { x: Math.max(40, Math.min(WORLD - 40, x)), y: Math.max(40, Math.min(WORLD - 40, y)) };
}
export function randomRoadPoint(city, rnd) {
  const vertical = rnd() < 0.5;
  const road = vertical
    ? city.roadsX[Math.floor(rnd() * city.roadsX.length)]
    : city.roadsY[Math.floor(rnd() * city.roadsY.length)];
  const along = 260 + rnd() * (WORLD - 560);
  return vertical ? { x: road, y: along } : { x: along, y: road };
}
