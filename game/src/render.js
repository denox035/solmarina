// render.js — draws Solmarina top-down on a canvas: ground, water and beach,
// the road grid with lane markings, blocks and buildings with soft shadows,
// the park, the marina, cars, pedestrians, the player, bullets, particles
// and the pulsing mission beacon. Dusk mode warms the whole palette.

function drawCity(ctx, G, view) {
  const dusk = G.dusk;
  const ground = dusk ? '#7a7a55' : '#8fae6e';
  const road = dusk ? '#3d3d46' : '#4a4a55';
  const line = dusk ? '#c9a227' : '#e8d44d';
  ctx.fillStyle = ground;
  ctx.fillRect(view.x, view.y, view.w, view.h);

  // The sea and the beach, west edge.
  ctx.fillStyle = dusk ? '#2e4a66' : '#3d7ea6';
  ctx.fillRect(view.x, view.y, Math.max(0, 90 - view.x), view.h);
  ctx.fillStyle = dusk ? '#c2a878' : '#e8d8a0';
  ctx.fillRect(Math.max(view.x, 90), view.y, Math.max(0, 210 - Math.max(view.x, 90)), view.h);
  // Marina basin, south-east.
  ctx.fillStyle = dusk ? '#2e4a66' : '#3d7ea6';
  ctx.fillRect(Math.max(view.x, 2020), Math.max(view.y, 1520), view.w, view.h);

  // Blocks: pale sidewalk rectangles between the roads.
  ctx.fillStyle = dusk ? '#6a6a72' : '#9a9aa2';
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2, x1 = AVENUES[ai + 1] - ROAD_W / 2;
      const y0 = STREETS[si] + ROAD_W / 2, y1 = STREETS[si + 1] - ROAD_W / 2;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Coral Park stays green.
  ctx.fillStyle = dusk ? '#3d6b38' : '#5da85a';
  ctx.fillRect(1150, 750, 260, 180);
  ctx.fillStyle = dusk ? '#2e5b2e' : '#4c8a48';
  for (let i = 0; i < 9; i++) {
    const tx = 1180 + (i % 3) * 90, ty = 780 + Math.floor(i / 3) * 55;
    ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill();
  }

  // Roads.
  ctx.fillStyle = road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = line;
  for (const ax of AVENUES) {
    for (let y = 40; y < WORLD_H; y += 64) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of STREETS) {
    for (let x = 40; x < WORLD_W; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
  }

  // Buildings: shadow, walls, roof, landmark label.
  for (const b of G.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + b.height * 0.5 + 4, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.landmark, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }

  // Sunset Pier planks over the water.
  ctx.fillStyle = '#8a6b4f';
  ctx.fillRect(60, 937, 130, 46);
  ctx.fillStyle = '#6e543d';
  for (let x = 70; x < 185; x += 16) ctx.fillRect(x, 937, 3, 46);
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.color;
  ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-car.w / 2 + 8, -car.h / 2 + 4, 12, car.h - 8); // windshield
  ctx.fillRect(car.w / 2 - 16, -car.h / 2 + 4, 8, car.h - 8); // rear window
  if (car.isCop) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -car.h / 2 + 2, 12, 4);
    ctx.fillRect(-6, car.h / 2 - 6, 12, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-car.w / 2 + 2, -car.h / 2 - 3, 8, 5);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(-car.w / 2 + 2, car.h / 2 - 2, 8, 5);
  }
  if (car.hp < 35) {
    ctx.fillStyle = 'rgba(60,60,60,0.7)';
    ctx.beginPath(); ctx.arc(-car.w / 4, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, G) {
  const cv = ctx.canvas;
  const view = { x: G.camera.x - cv.width / 2 / G.camera.zoom, y: G.camera.y - cv.height / 2 / G.camera.zoom, w: cv.width / G.camera.zoom, h: cv.height / G.camera.zoom };
  ctx.save();
  ctx.scale(G.camera.zoom, G.camera.zoom);
  ctx.translate(-view.x, -view.y);
  drawCity(ctx, G, { x: Math.max(0, view.x - 50), y: Math.max(0, view.y - 50), w: view.w + 100, h: view.h + 100 });

  // Mission beacon: a pulsing ring over the target.
  const target = missionTarget(G);
  if (target) {
    const pulse = 1 + Math.sin(G.time * 4) * 0.15;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.beginPath(); ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(target.x, target.y, 6, 0, Math.PI * 2); ctx.fill();
  }

  for (const car of G.cars) drawCarShape(ctx, car);

  // Pedestrians: a dot with a direction tick.
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 9, 5, ped.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c2c34';
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Foot officers in navy with a cap brim.
  for (const cop of G.cops) {
    if (!cop.onFoot || cop.down) continue;
    ctx.fillStyle = '#1c3a5e';
    ctx.beginPath(); ctx.arc(cop.x, cop.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfe8f0';
    ctx.fillRect(cop.x - 5, cop.y - 3, 10, 3);
  }

  // The player: on foot a gold-ringed walker, in a car the car itself.
  const p = G.player;
  if (!p.inCar && p.state === 'alive') {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c2c34';
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
    ctx.stroke();
    if (p.weapon === 'pistol') {
      ctx.fillStyle = '#ddd';
      ctx.fillRect(p.x + Math.cos(p.angle) * 10 - 2, p.y + Math.sin(p.angle) * 10 - 2, 8, 4);
    }
  }

  // Bullets as bright streaks.
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * clamp(pt.life / pt.max, 0.3, 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
