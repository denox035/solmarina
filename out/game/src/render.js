// render.js — camera + all world drawing (Canvas 2D, hand-drawn top-down art).
import { BEACH_Y, MARINA_X, ROAD, WORLD } from './city.js';
import { drawHUD } from './hud.js';

export function render(G) {
  const ctx = G.ctx, W = G.canvas.width, H = G.canvas.height;
  const p = G.player;
  // Camera follows the player (or their car), clamped to the world.
  const zoom = G.zoom || 1;
  let cx = p.x - W / 2 / zoom, cy = p.y - H / 2 / zoom;
  cx = Math.max(0, Math.min(WORLD - W / zoom, cx));
  cy = Math.max(0, Math.min(WORLD - H / zoom, cy));
  if (G.shake > 0) { cx += (Math.random() - 0.5) * G.shake; cy += (Math.random() - 0.5) * G.shake; G.shake *= 0.88; if (G.shake < 0.4) G.shake = 0; }
  G.cam = { x: cx, y: cy, zoom };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
  drawGround(G, ctx);
  drawCity(G, ctx);
  drawMarina(G, ctx);
  drawPickups(G, ctx);
  drawCars(G, ctx);
  drawPeds(G, ctx);
  drawEnemies(G, ctx);
  drawCops(G, ctx);
  drawBullets(G, ctx);
  drawPlayer(G, ctx);
  drawMissionMarker(G, ctx);
  drawFloaters(G, ctx);
  ctx.restore();
  if (G.state === 'play' || G.state === 'pause') drawHUD(G, ctx, W, H);
  if (G.state === 'title') drawTitle(G, ctx, W, H);
  if (G.state === 'pause') drawPause(G, ctx, W, H);
  if (G.state === 'dead') drawEndScreen(G, ctx, W, H, 'WASTED');
  if (G.state === 'win') drawEndScreen(G, ctx, W, H, 'SOLMARINA IS YOURS');
}

function drawGround(G, ctx) {
  // Grass base.
  ctx.fillStyle = '#4a7d4f';
  ctx.fillRect(0, 0, WORLD, WORLD);
  // Subtle grass mottle (deterministic).
  ctx.fillStyle = 'rgba(0,0,0,.05)';
  for (let i = 0; i < 220; i++) {
    const x = (i * 733) % WORLD, y = (i * 1123) % WORLD;
    ctx.fillRect(x, y, 26, 18);
  }
  // Sand beach (south).
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(0, BEACH_Y, WORLD, WORLD - BEACH_Y);
  // Sea (far south + far east).
  ctx.fillStyle = '#1d6a8a';
  ctx.fillRect(0, BEACH_Y + 240, WORLD, WORLD - BEACH_Y - 240);
  ctx.fillStyle = '#2a7a9a';
  ctx.fillRect(MARINA_X + 300, 0, WORLD - MARINA_X - 300, WORLD);
  // Wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = BEACH_Y + 250 + i * 14;
    ctx.beginPath();
    for (let x = 0; x <= WORLD; x += 60) ctx.lineTo(x, y + Math.sin(x / 90 + i) * 3);
    ctx.stroke();
  }
  // Roads: sidewalk border, asphalt, centre dashes.
  for (const r of G.city.roadsX) {
    ctx.fillStyle = '#c8b89a'; ctx.fillRect(r - ROAD / 2 - 12, 0, ROAD + 24, WORLD);
    ctx.fillStyle = '#3a3f4a'; ctx.fillRect(r - ROAD / 2, 0, ROAD, WORLD);
  }
  for (const r of G.city.roadsY) {
    ctx.fillStyle = '#c8b89a'; ctx.fillRect(0, r - ROAD / 2 - 12, WORLD, ROAD + 24);
    ctx.fillStyle = '#3a3f4a'; ctx.fillRect(0, r - ROAD / 2, WORLD, ROAD);
  }
  ctx.strokeStyle = '#e8d84a'; ctx.lineWidth = 2; ctx.setLineDash([18, 22]);
  for (const r of G.city.roadsX) { ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r, WORLD); ctx.stroke(); }
  for (const r of G.city.roadsY) { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(WORLD, r); ctx.stroke(); }
  ctx.setLineDash([]);
}

function drawCity(G, ctx) {
  for (const b of G.city.buildings) {
    if (b.kind === 'park') {
      ctx.fillStyle = '#3a6d3a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#2a8a3a';
      for (let i = 0; i < b.trees; i++) {
        const tx = b.x + 20 + ((i * 67) % Math.max(20, b.w - 40));
        const ty = b.y + 20 + ((i * 91) % Math.max(20, b.h - 40));
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
      }
      // Park benches.
      ctx.fillStyle = '#8a6a4a';
      for (let i = 0; i < (b.benches || 2); i++) {
        ctx.fillRect(b.x + 16 + i * 34, b.y + b.h - 22, 26, 6);
      }
      continue;
    }
    // Shadow + body + roof detail.
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Windows.
    ctx.fillStyle = 'rgba(30,50,80,.55)';
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      ctx.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 12, 12);
    }
    if (b.floors >= 4) {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('▮'.repeat(Math.min(5, b.floors)), b.x + 6, b.y + 14);
    }
  }
  // Beach umbrellas.
  for (const u of G.city.beachProps) {
    ctx.fillStyle = u.hue < 0.5 ? '#e84a6a' : '#4a9ad8';
    ctx.beginPath(); ctx.arc(u.x, u.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(u.x - 1, u.y, 2, 14);
  }
  // Landmark labels.
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const k of Object.keys(G.city.landmarks)) {
    const L = G.city.landmarks[k];
    ctx.fillStyle = 'rgba(8,14,28,.6)';
    const w = ctx.measureText(L.name).width + 12;
    ctx.fillRect(L.x - w / 2, L.y - 34, w, 18);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(L.name, L.x, L.y - 30);
  }
  ctx.textAlign = 'left';
}

function drawMarina(G, ctx) {
  ctx.fillStyle = '#8a6a4a';
  for (const d of G.city.docks) {
    ctx.fillRect(d.x, d.y - 8, d.len, 16);
    for (let i = 0; i < 5; i++) ctx.fillRect(d.x + 30 + i * 50, d.y - 8, 3, 16);
  }
  for (const b of G.city.boats) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.lineTo(16, 8); ctx.lineTo(-16, 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -16, 12, 9);
    ctx.restore();
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.wrecked) ctx.globalAlpha = 0.6;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(-22, -10, 46, 24);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.moveTo(-22, -12); ctx.lineTo(18, -12); ctx.lineTo(24, -6); ctx.lineTo(24, 6); ctx.lineTo(18, 12); ctx.lineTo(-22, 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(20,40,70,.8)';
  ctx.fillRect(-4, -9, 14, 18);
  ctx.fillStyle = 'rgba(180,220,255,.7)';
  ctx.fillRect(8, -9, 4, 18);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(22, -10, 3, 5); ctx.fillRect(22, 5, 3, 5);
  if (car.ai === 'police') {
    ctx.fillStyle = '#fff'; ctx.fillRect(-20, -12, 40, 4); ctx.fillRect(-20, 8, 40, 4);
    const on = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = on ? '#ff4a4a' : '#4a7dff';
    ctx.beginPath(); ctx.arc(-2, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.fillText('PD', -8, 3);
  }
  ctx.restore();
}

function drawCars(G, ctx) {
  for (const car of G.cars) {
    if (car.ai === 'traffic' || car.ai === 'mission' || car.parked || car.player) drawCarShape(ctx, car);
  }
}

function drawPedShape(ctx, x, y, angle, shirt, pants, phase, scale = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  const swing = Math.sin(phase) * 4;
  ctx.fillStyle = pants;
  ctx.fillRect(-3, -6 + swing * 0.3, 6, 5);
  ctx.fillRect(-3, 1 - swing * 0.3, 6, 5);
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath(); ctx.arc(9, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPeds(G, ctx) {
  for (const ped of G.peds) {
    drawPedShape(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.walkPhase);
    if (ped.scared) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('!', ped.x + 10, ped.y - 12);
    }
  }
}

function drawEnemies(G, ctx) {
  for (const e of G.enemies) {
    drawPedShape(ctx, e.x, e.y, e.angle, '#8a2a2a', '#222', e.walkPhase, 1.1);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#e84a4a'; ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 70), 5);
    if (e.aggro) { ctx.fillStyle = '#ff6a6a'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('!', e.x + 12, e.y - 20); }
  }
}

function drawCops(G, ctx) {
  for (const cop of G.cops) {
    if (cop.kind === 'car') { drawCarShape(ctx, cop); continue; }
    drawPedShape(ctx, cop.x, cop.y, cop.angle, '#1a2a5a', '#1a1a2e', G.time * 8, 1.1);
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText('PD', cop.x - 6, cop.y - 14);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cop.x - 12, cop.y - 22, 24, 4);
    ctx.fillStyle = '#4a7dff'; ctx.fillRect(cop.x - 12, cop.y - 22, 24 * Math.max(0, cop.hp / 50), 4);
  }
}

function drawBullets(G, ctx) {
  ctx.fillStyle = '#ffe94a';
  for (const b of G.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillRect(-7, -1.5, 14, 3);
    ctx.restore();
  }
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.inCar) return;
  if (p.hp <= 0) return;
  const blink = p.hurtCd > 0 && Math.floor(G.time * 14) % 2 === 0;
  if (blink) return;
  drawPedShape(ctx, p.x, p.y, p.angle, '#ffd24a', '#2a3040', G.time * (p.moving ? 8 : 2), 1.15);
  if (p.weapon === 'pistol') {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46); ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.save(); ctx.translate(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14); ctx.rotate(p.angle);
    ctx.fillRect(0, -2, 12, 4); ctx.restore();
  }
  if (G.stealTarget) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press E — steal the ' + (G.stealTarget.name || 'car'), p.x, p.y - 28);
    ctx.textAlign = 'left';
  }
}

function drawPickups(G, ctx) {
  for (const pk of G.pickups) {
    const bob = Math.sin(pk.t * 3) * 3;
    ctx.save(); ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff'; ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#e84a4a'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#2a6a2a'; ctx.fillRect(-10, -8, 20, 16);
      ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.fillText('AMMO', -9, 3);
    } else if (pk.kind === 'vaultcash') {
      const pulse = 1 + Math.sin(pk.t * 5) * 0.15;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(-14, -10, 28, 20);
      ctx.fillStyle = '#7a5a00'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.fillText('$', -4, 5);
    }
    ctx.restore();
  }
}

function drawMissionMarker(G, ctx) {
  if (!G.mission || !G.mission.target) return;
  const t = G.mission.target;
  const pulse = 1 + Math.sin(G.time * 4) * 0.2;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(10, -34); ctx.lineTo(-10, -34); ctx.closePath(); ctx.fill();
  ctx.restore();
  const cam = G.cam;
  if (!cam) return;
  const vw = G.canvas.width / cam.zoom, vh = G.canvas.height / cam.zoom;
  const inView = t.x > cam.x && t.x < cam.x + vw && t.y > cam.y && t.y < cam.y + vh;
  if (!inView) {
    const ax = Math.max(cam.x + 40, Math.min(cam.x + vw - 40, t.x));
    const ay = Math.max(cam.y + 40, Math.min(cam.y + vh - 40, t.y));
    const ang = Math.atan2(t.y - ay, t.x - ax);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawFloaters(G, ctx) {
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - f.t * 30);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawTitle(G, ctx, W, H) {
  ctx.fillStyle = 'rgba(6,10,22,.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SOLMARINA', W / 2, H / 2 - 110);
  ctx.fillStyle = '#7dd8ff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('A sun-soaked coastal city. Five jobs. One legend.', W / 2, H / 2 - 66);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'You are MARCO SOL, a driver fresh out of the marina lockup.',
    'Rico the fixer has work: steal cars, run packages, tail a rat,',
    'rob Banco del Sol — and live to spend it.',
    '',
    'WASD move / drive · E steal car · Mouse aim, Click shoot · F punch',
    'M start a job · P pause · Wanted stars fade when you hide.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 20 + i * 24));
  ctx.fillStyle = G.saveExists ? '#7dff8a' : '#ffd24a';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(G.saveExists ? 'ENTER — Continue your story (save found)    ·    N — New game' : 'ENTER — Start the story', W / 2, H / 2 + 170);
  if (G.saveExists && G.saveSummary) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(G.saveSummary, W / 2, H / 2 + 196);
  }
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Original fiction. No real city, no real gang, no licensed anything.', W / 2, H - 24);
  ctx.textAlign = 'left';
}

function drawPause(G, ctx, W, H) {
  ctx.fillStyle = 'rgba(6,10,22,.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P — resume · S — save game · R — restart · M — toggle mute', W / 2, H / 2 + 20);
  ctx.textAlign = 'left';
}

function drawEndScreen(G, ctx, W, H, title) {
  ctx.fillStyle = 'rgba(6,10,22,.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'WASTED' ? '#ff5a5a' : '#ffd24a';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(G.msg || '', W / 2, H / 2 - 16);
  ctx.fillText(`Cash $${Math.floor(G.player.cash)} · Jobs done ${G.stats.missionsDone}/5 · Cars stolen ${G.stats.carsStolen} · Kills ${G.stats.kills}`, W / 2, H / 2 + 20);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('ENTER — play again', W / 2, H / 2 + 64);
  ctx.textAlign = 'left';
}
