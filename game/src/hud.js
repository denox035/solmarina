// SOLMARINA HUD: wanted stars, health, cash, mission objective, minimap,
// toasts, and the title / pause / wasted / busted screens — all on canvas.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  function star(ctx, x, y, r, filled) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.45;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap(ctx, w, x, y, mw, mh) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,24,0.82)';
    ctx.fillRect(x, y, mw, mh);
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, mw, mh);
    var sx = mw / City.W, sy = mh / City.H;
    // Sea + beach.
    ctx.fillStyle = '#2b7fb8';
    ctx.fillRect(x, y + City.SEA_Y * sy, mw, mh - City.SEA_Y * sy);
    ctx.fillStyle = '#e8d28a';
    ctx.fillRect(x, y + 1640 * sy, mw, (City.SEA_Y - 1640) * sy);
    // Roads.
    ctx.strokeStyle = '#8a929c';
    ctx.lineWidth = 2;
    for (var i = 0; i < City.roadsV.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x + City.roadsV[i] * sx, y);
      ctx.lineTo(x + City.roadsV[i] * sx, y + mh);
      ctx.stroke();
    }
    for (var j = 0; j < City.roadsH.length; j++) {
      ctx.beginPath();
      ctx.moveTo(x, y + City.roadsH[j] * sy);
      ctx.lineTo(x + mw, y + City.roadsH[j] * sy);
      ctx.stroke();
    }
    // Park.
    ctx.fillStyle = '#4e8f4a';
    ctx.fillRect(x + City.park.x * sx, y + City.park.y * sy,
      City.park.w * sx, City.park.h * sy);
    // Mission target.
    if (w.missions && w.missions.active && w.missions.state && w.missions.state.target) {
      var tg = w.missions.state.target;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(x + tg.x * sx, y + tg.y * sy, 5, 0, 7);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#4a90d9';
    for (var p = 0; p < w.police.length; p++) {
      var c = w.police[p];
      if (c.dead) continue;
      ctx.beginPath();
      ctx.arc(x + c.x * sx, y + c.y * sy, 3, 0, 7);
      ctx.fill();
    }
    // Player arrow.
    var pl = w.player;
    var px = x + pl.x * sx, py = y + pl.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(pl.inCar ? pl.inCar.angle : pl.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', x + 4, y + 12);
    ctx.restore();
  }

  function drawHUD(ctx, w) {
    var pl = w.player;
    // Top-left: wanted stars + health bar.
    ctx.textAlign = 'left';
    for (var i = 0; i < 5; i++) star(ctx, 30 + i * 26, 30, 11, i < w.wanted.stars);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(18, 48, 190, 14);
    ctx.fillStyle = pl.hp > 50 ? '#58d158' : pl.hp > 25 ? '#f2a541' : '#e33e2b';
    ctx.fillRect(20, 50, 186 * Math.max(0, pl.hp / pl.maxHp), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('HP ' + Math.ceil(pl.hp), 22, 60);
    // Top-right: cash + time + weapon.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('$' + pl.cash, 1262, 34);
    ctx.font = '12px sans-serif';
    ctx.fillText(w.clock, 1262, 54);
    ctx.fillText(pl.inCar ? pl.weapon.toUpperCase() + '  •  IN ' + pl.inCar.model.name.toUpperCase()
      : pl.weapon.toUpperCase(), 1262, 72);
    if (pl.weapon === 'pistol') {
      ctx.fillText(pl.reloadT > 0 ? 'RELOADING…' : 'AMMO ' + pl.ammo + '/12', 1262, 90);
    }
    // Speed when driving (top-right, clear of the minimap).
    if (pl.inCar) {
      var kmh = Math.round(Math.abs(pl.inCar.speed) * 0.36);
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(kmh + ' km/h', 1262, 112);
      ctx.font = '11px sans-serif';
      var hpFrac = Math.max(0, pl.inCar.hp / pl.inCar.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(1142, 120, 120, 8);
      ctx.fillStyle = hpFrac > 0.5 ? '#58d158' : '#e33e2b';
      ctx.fillRect(1144, 122, 116 * hpFrac, 4);
    }
    // Mission objective, bottom-left.
    if (w.missions.active) {
      var def = S.Missions.currentDef(w.missions);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      var lines = wrapText(ctx, def.brief, 300);
      var h = 34 + lines.length * 16;
      ctx.fillRect(16, 720 - 16 - h, 330, h);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('★ ' + def.title + (def.time ? '  —  ' + Math.ceil(w.missions.timer) + 's' : ''), 28, 720 - h + 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], 28, 720 - h + 24 + li * 16);
      }
    } else if (w.missions.index < S.Missions.MISSIONS.length) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(16, 668, 330, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press M to start the next job: ' + S.Missions.currentDef(w.missions).title, 28, 690);
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(16, 668, 330, 36);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('STORY COMPLETE — free roam. Enjoy Solmarina!', 28, 690);
    }
    // Minimap, bottom-right.
    drawMinimap(ctx, w, 1280 - 216, 720 - 176, 200, 160);
    // Toasts.
    ctx.textAlign = 'center';
    for (var t = 0; t < w.toasts.length; t++) {
      var toast = w.toasts[t];
      ctx.globalAlpha = Math.min(1, toast.life);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      var tw = ctx.measureText(toast.text).width + 28;
      ctx.fillRect(640 - tw / 2, 92 + t * 30, tw, 24);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(toast.text, 640, 109 + t * 30);
      ctx.globalAlpha = 1;
    }
    // Controls hint.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD move/drive • E enter car • F punch • Click shoot • 1/2 weapons • M mission • P pause • N mute', 16, 706);
  }

  function wrapText(ctx, text, maxW) {
    var words = text.split(' ');
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawTitle(ctx, w) {
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, 1280, 720);
    // Sun + skyline silhouette.
    var g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#ff9a5c');
    g.addColorStop(0.55, '#e86a8a');
    g.addColorStop(1, '#2b1d52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 470);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(1020, 130, 62, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1430';
    for (var i = 0; i < 22; i++) {
      var bx = i * 60 + ((i * 37) % 23);
      var bh = 90 + ((i * 53) % 130);
      ctx.fillRect(bx, 470 - bh, 48, bh);
    }
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 470, 1280, 250);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText('SOLMARINA', 640, 210);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('AN OPEN-WORLD CRIME STORY', 640, 252);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText('A sun-soaked coastal city. Steal cars, dodge the Solmarina PD,', 640, 520);
    ctx.fillText('and run six jobs for Mara Voss — from first wheels to the big one.', 640, 544);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = (Math.sin(w.time * 4) > 0) ? '#ffd94a' : '#ffffff';
    ctx.fillText(w.saveExists ? 'Press ENTER to continue — or N for a new game' : 'Press ENTER to start', 640, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move / drive   •   E enter & steal cars   •   F punch   •   Click shoot   •   M mission   •   P pause', 640, 648);
    ctx.fillText('Missions, wanted stars, police chases, traffic, pedestrians, minimap, save — all in one city.', 640, 672);
  }

  function drawPause(ctx, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', 640, 320);
    ctx.font = '16px sans-serif';
    ctx.fillText('P resume  •  M mission  •  N mute  •  R restart day', 640, 360);
  }

  function drawEnd(ctx, w, kind) {
    ctx.fillStyle = kind === 'busted' ? 'rgba(20,40,90,0.75)' : 'rgba(90,10,10,0.75)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', 640, 320);
    ctx.font = '16px sans-serif';
    if (kind === 'busted') ctx.fillText('The PD caught you. Fine paid: $' + w.fine + '. Press ENTER to walk free.', 640, 360);
    else ctx.fillText('You went down. The hospital patched you up for $' + w.fine + '. Press ENTER to get up.', 640, 360);
  }

  S.HUD = { drawHUD: drawHUD, drawMinimap: drawMinimap, drawTitle: drawTitle,
    drawPause: drawPause, drawEnd: drawEnd, wrapText: wrapText };
})();
