// SOLMARINA city: seeded procedural coastal city — roads, blocks, buildings,
// beach, marina, park and the special landmarks. All geometry lives here;
// nothing in this file reads the old game.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;

  // Deterministic RNG so the city is identical every load.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  S.rng = mulberry32(20261119);

  var W = 2560, H = 1920;
  var ROAD_W = 56, WALK = 14;
  // Road centre lines.
  var roadsV = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
  var roadsH = [160, 440, 720, 1000, 1280, 1560];
  var SEA_Y = 1760;      // water starts here (south edge)
  var MARINA_X = 2320;   // docks live east of here

  var PALETTE = [
    '#c96f4a', '#d9a066', '#8fa8bf', '#b5c4a1', '#d97b6c', '#7f9bb3',
    '#e0c084', '#a87f5f', '#94b8a2', '#c2b49a', '#e88f7a', '#6f8fa8'
  ];

  function rand(a, b) { return a + S.rng() * (b - a); }
  function pick(arr) { return arr[Math.floor(S.rng() * arr.length)]; }

  var buildings = [];
  var trees = [];
  var boats = [];

  // Park block: between roadsV[3..4] x roadsH[1..2].
  var park = { x: 1120 + ROAD_W / 2 + WALK, y: 440 + ROAD_W / 2 + WALK,
    w: 320 - ROAD_W - 2 * WALK, h: 280 - ROAD_W - 2 * WALK };

  function inPark(x, y) {
    return x > park.x && x < park.x + park.w && y > park.y && y < park.y + park.h;
  }
  function inBeach(x, y) { return y > 1640 && y < SEA_Y; }
  function inSea(x, y) { return y >= SEA_Y; }
  function inMarina(x, y) { return x > MARINA_X && y < 1560; }

  // Fill every road block with buildings, skipping park / beach / marina.
  for (var bi = 0; bi < roadsV.length - 1; bi++) {
    for (var bj = 0; bj < roadsH.length - 1; bj++) {
      var x0 = roadsV[bi] + ROAD_W / 2 + WALK;
      var y0 = roadsH[bj] + ROAD_W / 2 + WALK;
      var x1 = roadsV[bi + 1] - ROAD_W / 2 - WALK;
      var y1 = roadsH[bj + 1] - ROAD_W / 2 - WALK;
      if (x1 - x0 < 40 || y1 - y0 < 40) continue;
      if (inPark((x0 + x1) / 2, (y0 + y1) / 2)) continue;
      if (inBeach((x0 + x1) / 2, (y0 + y1) / 2)) continue;
      if (inMarina((x0 + x1) / 2, (y0 + y1) / 2)) continue;
      var n = 1 + Math.floor(S.rng() * 3);
      for (var k = 0; k < n; k++) {
        var bw = rand(50, (x1 - x0) / n - 8);
        var bh = rand(44, (y1 - y0) - 8);
        var bx = x0 + ((x1 - x0) / n) * k + rand(2, 8);
        var by = y0 + rand(2, Math.max(3, (y1 - y0) - bh - 2));
        bw = Math.min(bw, x1 - bx - 2); bh = Math.min(bh, y1 - by - 2);
        if (bw < 30 || bh < 26) continue;
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: pick(PALETTE), tall: S.rng() < 0.22,
          roof: pick(['#5a4632', '#3f5a4a', '#6b5a6e', '#7a6a55'])
        });
      }
    }
  }

  // Park trees.
  for (var t = 0; t < 26; t++) {
    trees.push({ x: rand(park.x + 14, park.x + park.w - 14),
      y: rand(park.y + 14, park.y + park.h - 14), r: rand(7, 13) });
  }
  // Beach palms.
  for (var p = 0; p < 18; p++) {
    trees.push({ x: rand(80, 2480), y: rand(1652, 1748), r: rand(6, 10), palm: true });
  }
  // Marina boats.
  for (var b = 0; b < 9; b++) {
    boats.push({ x: rand(MARINA_X + 40, 2540), y: rand(200, 1500),
      a: rand(-0.4, 0.4), len: rand(34, 58), color: pick(['#f2f2f2', '#d9e8f2', '#ffe9a8']) });
  }

  // Landmarks (special buildings placed by hand on the grid).
  function landmark(name, cx, cy, w, h, color) {
    var b = { x: cx - w / 2, y: cy - h / 2, w: w, h: h, color: color,
      tall: true, roof: '#2e3a4d', name: name };
    buildings.push(b);
    return b;
  }
  var tower = landmark('Meridian Tower', 1120, 1000, 120, 90, '#7f9bb3');
  var casino = landmark('Solmarina Grand', 800, 1560, 150, 80, '#d9a066');
  var hospital = landmark('St. Lumen Hospital', 1760, 440, 130, 80, '#e8e8e8');
  var policeHQ = landmark('Solmarina PD HQ', 480, 1000, 120, 80, '#5a7ea6');
  var garage = landmark("Mara's Garage", 2080, 1280, 110, 70, '#c96f4a');
  var spray = landmark('Pay N Spray', 1440, 1560, 90, 60, '#94b8a2');

  // Intersection graph for traffic.
  var intersections = [];
  for (var i = 0; i < roadsV.length; i++) {
    for (var j = 0; j < roadsH.length; j++) {
      intersections.push({ x: roadsV[i], y: roadsH[j] });
    }
  }

  function onRoadX(x) {
    for (var i = 0; i < roadsV.length; i++)
      if (Math.abs(x - roadsV[i]) < ROAD_W / 2 + 2) return true;
    return false;
  }
  function onRoadY(y) {
    for (var j = 0; j < roadsH.length; j++)
      if (Math.abs(y - roadsH[j]) < ROAD_W / 2 + 2) return true;
    return false;
  }
  function isRoad(x, y) { return onRoadX(x) || onRoadY(y); }
  function isWater(x, y) { return inSea(x, y); }
  function isBlocked(x, y, r) {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    if (inSea(x, y)) return true;
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }
  // Slide along a building instead of sticking: try axis-separated moves.
  function moveWithCollision(x, y, dx, dy, r) {
    var nx = x + dx, ny = y + dy;
    if (!isBlocked(nx, y, r)) x = nx;
    if (!isBlocked(x, ny, r)) y = ny;
    return { x: x, y: y };
  }
  function nearestIntersection(x, y) {
    var best = null, bd = 1e18;
    for (var i = 0; i < intersections.length; i++) {
      var d = (intersections[i].x - x) * (intersections[i].x - x) +
              (intersections[i].y - y) * (intersections[i].y - y);
      if (d < bd) { bd = d; best = intersections[i]; }
    }
    return best;
  }
  function randomRoadPoint() {
    if (S.rng() < 0.5) {
      return { x: pick(roadsV) + rand(-14, 14), y: rand(80, 1600) };
    }
    return { x: rand(80, 2280), y: pick(roadsH) + rand(-14, 14) };
  }

  S.City = {
    W: W, H: H, ROAD_W: ROAD_W, WALK: WALK, roadsV: roadsV, roadsH: roadsH,
    SEA_Y: SEA_Y, MARINA_X: MARINA_X, buildings: buildings, trees: trees,
    boats: boats, park: park, intersections: intersections,
    tower: tower, casino: casino, hospital: hospital, policeHQ: policeHQ,
    garage: garage, spray: spray,
    isRoad: isRoad, isWater: isWater, isBlocked: isBlocked,
    moveWithCollision: moveWithCollision, inPark: inPark, inBeach: inBeach,
    inMarina: inMarina, nearestIntersection: nearestIntersection,
    randomRoadPoint: randomRoadPoint, rand: rand, pick: pick
  };
})();
