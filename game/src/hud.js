// hud.js — everything on top of the world: wanted stars, health and cash,
// the clock, the speedometer, the mission objective, the minimap, toasts,
// and the title, pause, busted and wasted screens.

function drawHud(ctx, G) {
  const cv = ctx.canvas;
  const p = G.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Wanted stars, top left.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#f1c40f' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, 28 + i * 30, 26, 11);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(wantedLabel(G.wanted), 24, 52);

  // Health bar under the stars.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(24, 76, 170, 14);
  ctx.fillStyle = p.hp > 50 ? '#2ecc71' : p.hp > 25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(24, 76, 170 * (p.hp / 100), 14);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('HP ' + Math.round(p.hp), 200, 77);

  // Cash and clock, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), cv.width - 24, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(G.clockText, cv.width - 24, 50);
  ctx.fillText(p.weapon === 'pistol' ? 'Pistol  •  ' + p.ammo + ' rounds' : 'Fists', cv.width - 24, 72);

  // Mission objective, top centre.
  if (G.mission) {
    const m = G.mission;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const label = m.name + (m.timer > 0 ? '  —  ' + Math.ceil(G.missionTime) + 's' : '');
    ctx.fillRect(cv.width / 2 - 260, 14, 520, 40);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(label, cv.width / 2, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(m.brief, cv.width / 2, 40);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press M for the next job  •  ' + (G.completedMissions || 0) + ' of 6 jobs done', cv.width / 2, 22);
  }

  // Speedometer, bottom right (driving only).
  if (p.inCar) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', cv.width - 24, cv.height - 58);
    ctx.font = '14px sans-serif';
    ctx.fillText(p.inCar.name + (p.inCar.hp < 35 ? '  —  smoking!' : ''), cv.width - 24, cv.height - 28);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    const near = nearestStealableCar(p, G.cars);
    if (near) ctx.fillText('Press E to steal the ' + near.name, cv.width - 24, cv.height - 28);
  }

  // Toasts, centre-bottom.
  if (G.toast && G.toastTime > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = Math.min(640, ctx.measureText(G.toast).width + 40);
    ctx.fillRect(cv.width / 2 - w / 2, cv.height - 110, w, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(G.toast, cv.width / 2, cv.height - 102);
  }

  drawMinimap(ctx, G);
  ctx.restore();
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, G) {
  const cv = ctx.canvas;
  const mw = 190, mh = 142;
  const x0 = cv.width - mw - 20, y0 = cv.height - mh - 20;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = '#3d7ea6';
  ctx.fillRect(x0, y0, 90 * sx, mh);
  ctx.fillStyle = '#8fae6e';
  ctx.fillRect(x0 + 90 * sx, y0, mw - 90 * sx, mh);
  ctx.fillStyle = '#4a4a55';
  for (const ax of AVENUES) ctx.fillRect(x0 + ax * sx - 1, y0, 2, mh);
  for (const sy2 of STREETS) ctx.fillRect(x0, y0 + sy2 * sy - 1, mw, 2);
  ctx.fillStyle = '#5da85a';
  ctx.fillRect(x0 + 1150 * sx, y0 + 750 * sy, 260 * sx, 180 * sy);
  const target = missionTarget(G);
  if (target) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of G.cops) {
    if (cop.down) continue;
    const cx = cop.onFoot ? cop.x : cop.car.x;
    const cy = cop.onFoot ? cop.y : cop.car.y;
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.arc(x0 + cx * sx, y0 + cy * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const p = G.player;
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.restore();
}

function drawTitle(ctx, G) {
  const cv = ctx.canvas;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.82)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMARINA', cv.width / 2, cv.height / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in a sun-soaked coastal city', cv.width / 2, cv.height / 2 - 66);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#d5d8dc';
  const lines = [
    'Mara Voss needs wheels, cash and a way out. Steal cars, outrun the',
    'Solmarina PD, and work six jobs — from a first stolen car to the',
    'Solmarina Job at Meridian Tower.',
    '',
    'WASD / arrows — move & drive    E — steal / exit car    F — punch',
    'Mouse click — shoot    1 / 2 — fists / pistol    M — next job',
    'P — pause    N — mute    R — reload',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, cv.width / 2, cv.height / 2 - 20 + i * 26));
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER or click to play', cv.width / 2, cv.height / 2 + 190);
  ctx.fillStyle = '#95a5a6';
  ctx.font = '13px sans-serif';
  ctx.fillText('Progress saves automatically in this browser.', cv.width / 2, cv.height / 2 + 224);
  ctx.restore();
}

function drawEnd(ctx, G, kind) {
  const cv = ctx.canvas;
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,40,80,0.78)' : 'rgba(80,10,10,0.78)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', cv.width / 2, cv.height / 2 - 30);
  ctx.font = '18px sans-serif';
  ctx.fillText(kind === 'busted' ? 'The Solmarina PD caught up with Mara. The job is blown.' : 'Mara went down. The city keeps moving without her.', cv.width / 2, cv.height / 2 + 12);
  ctx.fillText('Cash kept: $' + G.player.cash.toLocaleString('en-US') + '   •   Jobs done: ' + (G.completedMissions || 0) + ' of 6', cv.width / 2, cv.height / 2 + 48);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press ENTER to get back on the street', cv.width / 2, cv.height / 2 + 96);
  ctx.restore();
}

function drawPaused(ctx, G) {
  const cv = ctx.canvas;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', cv.width / 2, cv.height / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillText('P to resume  •  M for the next job  •  N to mute', cv.width / 2, cv.height / 2 + 28);
  ctx.restore();
}
