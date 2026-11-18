// hud.js — HUD: wanted stars, cash, health, speed, objective banner, minimap.
import { WORLD } from './city.js';

export function drawHUD(G, ctx, W, H) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'top';
  // --- Wanted stars (top right) ---
  const starX = W - 30;
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'right';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#ffd24a' : 'rgba(255,255,255,.35)';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(stars, starX, 10);
  ctx.shadowBlur = 0;
  // --- Cash + health (top left) ---
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${Math.floor(p.cash).toLocaleString('en-US')}`, 16, 12);
  // Health bar
  const bw = 180, bh = 14;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(16, 42, bw, bh);
  ctx.fillStyle = p.hp > 50 ? '#4ad88a' : p.hp > 25 ? '#e8a84a' : '#e84a4a';
  ctx.fillRect(16, 42, bw * Math.max(0, p.hp / p.maxHp), bh);
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
  ctx.strokeRect(16, 42, bw, bh);
  ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 200, 43);
  // Weapon + ammo
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#dfe9ff';
  ctx.fillText(p.inCar ? '🚗 ' + (p.inCar.name || 'Car') : (p.weapon === 'pistol' ? `🔫 Pistol — ${p.ammo} ammo` : '✊ Fists — find ammo for a pistol'), 16, 64);
  // Speed (bottom right) when driving
  if (p.inCar) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.36)} km/h`, W - 16, H - 44);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#dfe9ff';
    ctx.fillText('E — exit car', W - 16, H - 14);
  }
  // --- Objective banner (top centre) ---
  if (G.mission) {
    const title = `JOB ${G.mission.def.id}/5 — ${G.mission.def.name}`;
    const sub = G.objectiveHint || (G.mission.target ? G.mission.target.label : '');
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = Math.max(ctx.measureText(title).width, ctx.measureText(sub).width) + 28;
    ctx.fillStyle = 'rgba(8,14,28,.72)';
    roundRect(ctx, W / 2 - tw / 2, 10, tw, 46, 8); ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5;
    roundRect(ctx, W / 2 - tw / 2, 10, tw, 46, 8); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(title, W / 2, 14);
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(sub, W / 2, 34);
    G.objectiveHint = null;
  } else if (G.missionIdx < 5) {
    ctx.textAlign = 'center';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('Press M to start the next job', W / 2, 16);
  }
  // --- Message toast (centre, fades) ---
  if (G.msg && G.msgT > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, G.msgT)})`;
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText(G.msg, W / 2, H - 120);
    ctx.shadowBlur = 0;
  }
  // --- Floating +$ texts handled in render (world space) ---
  drawMinimap(G, ctx, W, H);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawMinimap(G, ctx, W, H) {
  const size = 168, pad = 12;
  const x0 = W - size - pad, y0 = H - size - pad - (G.player.inCar ? 30 : 0);
  const s = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,28,.78)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8); ctx.stroke();
  ctx.beginPath(); ctx.rect(x0, y0, size, size); ctx.clip();
  // Water + sand
  ctx.fillStyle = '#1d4e6e'; ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#3f7d6b'; ctx.fillRect(x0, y0, size, size * 0.88);
  // Beach + marina strips
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(x0, y0 + size * 0.87, size, size * 0.13);
  ctx.fillStyle = '#2a6a8a';
  ctx.fillRect(x0 + size * 0.87, y0, size * 0.13, size);
  // Roads
  ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 2;
  for (const r of G.city.roadsX) { ctx.beginPath(); ctx.moveTo(x0 + r * s, y0); ctx.lineTo(x0 + r * s, y0 + size); ctx.stroke(); }
  for (const r of G.city.roadsY) { ctx.beginPath(); ctx.moveTo(x0, y0 + r * s); ctx.lineTo(x0 + size, y0 + r * s); ctx.stroke(); }
  // Mission marker (pulsing yellow diamond)
  if (G.mission && G.mission.target) {
    const mx = x0 + G.mission.target.x * s, my = y0 + G.mission.target.y * s;
    const pr = 5 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(mx, my - pr); ctx.lineTo(mx + pr, my); ctx.lineTo(mx, my + pr); ctx.lineTo(mx - pr, my);
    ctx.closePath(); ctx.fill();
  }
  // Landmarks
  ctx.fillStyle = '#7dff8a';
  for (const k of Object.keys(G.city.landmarks)) {
    const L = G.city.landmarks[k];
    ctx.fillRect(x0 + L.x * s - 1.5, y0 + L.y * s - 1.5, 3, 3);
  }
  // Traffic (grey dots), cops (blue/red flashing), player (white triangle)
  ctx.fillStyle = 'rgba(220,220,220,.8)';
  for (const c of G.cars) {
    if (c.ai === 'traffic') ctx.fillRect(x0 + c.x * s - 1, y0 + c.y * s - 1, 2, 2);
  }
  for (const cop of G.cops) {
    ctx.fillStyle = (Math.floor(G.time * 4) % 2 === 0) ? '#ff4a4a' : '#4a7dff';
    ctx.fillRect(x0 + cop.x * s - 2, y0 + cop.y * s - 2, 4, 4);
  }
  const px = x0 + G.player.x * s, py = y0 + G.player.y * s;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(G.player.angle) * 6, py + Math.sin(G.player.angle) * 6);
  ctx.lineTo(px + Math.cos(G.player.angle + 2.5) * 5, py + Math.sin(G.player.angle + 2.5) * 5);
  ctx.lineTo(px + Math.cos(G.player.angle - 2.5) * 5, py + Math.sin(G.player.angle - 2.5) * 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
