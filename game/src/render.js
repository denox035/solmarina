// SOLMARINA render: draws the whole top-down city — ground, roads, beach and
// sea, buildings, park, marina, cars, people and the player — under a camera.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  function drawCar(ctx, car, dusk) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    var m = car.model;
    var L = m.len, Wd = m.wid;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-L / 2 + 2, -Wd / 2 + 3, L, Wd);
    // Body.
    ctx.fillStyle = car.kind === 'police' ? S.Vehicles.POLICE_COLORS[0] : m.color;
    roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 6);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    roundRect(ctx, -L * 0.18, -Wd / 2 + 3, L * 0.32, Wd - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(L * 0.14, -Wd / 2 + 4, 3, Wd - 8);
    // Headlights / tail lights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 2, 4);
    ctx.fillRect(L / 2 - 2, Wd / 2 - 6, 2, 4);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-L / 2, -Wd / 2 + 2, 2, 4);
    ctx.fillRect(-L / 2, Wd / 2 - 6, 2, 4);
    if (car.brakeLight) {
      ctx.fillStyle = 'rgba(255,60,40,0.85)';
      ctx.fillRect(-L / 2 - 1, -Wd / 2 + 1, 3, 5);
      ctx.fillRect(-L / 2 - 1, Wd / 2 - 6, 3, 5);
    }
    if (car.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-L * 0.05, -Wd / 2 + 1, L * 0.1, 3);
      ctx.fillStyle = '#dfe8ff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 1);
    }
    if (car.kind === 'player') {
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      roundRect(ctx, -L / 2 - 2, -Wd / 2 - 2, L + 4, Wd + 4, 7);
      ctx.stroke();
    }
    ctx.restore();
    // Wreck smoke.
    if (car.hp < car.maxHp * 0.4 && !car.dead) {
      ctx.fillStyle = 'rgba(90,90,90,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 8, car.y - Math.sin(car.angle) * 8, 5, 0, 7);
      ctx.fill();
    }
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

  function drawPerson(ctx, x, y, angle, shirt, skin, phase, dead) {
    ctx.save();
    ctx.translate(x, y);
    if (dead) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.fillRect(-8, -4, 16, 8);
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(11, 0, 4, 0, 7); ctx.fill();
      ctx.restore();
      return;
    }
    var bob = Math.sin(phase) * 1.5;
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 3, 7, 4, 0, 0, 7); ctx.fill();
    // Legs.
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-4 + bob, -4, 3, 8);
    ctx.fillRect(-4 - bob, -4, 3, 8);
    // Body + head.
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(7, 0, 4.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawWorld(ctx, w, cam, dusk) {
    var vw = 1280, vh = 720;
    // Ground: grass base.
    ctx.fillStyle = dusk ? '#4a6b46' : '#69a854';
    ctx.fillRect(cam.x, cam.y, vw, vh);
    // Sea + sand (south).
    ctx.fillStyle = dusk ? '#1d3a5c' : '#2b7fb8';
    ctx.fillRect(cam.x, Math.max(cam.y, City.SEA_Y), vw, vh);
    ctx.fillStyle = dusk ? '#8a7a56' : '#e8d28a';
    ctx.fillRect(cam.x, Math.max(cam.y, 1640), vw, City.SEA_Y - 1640);
    // Water shimmer lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (var wy = City.SEA_Y + 24; wy < City.SEA_Y + 160; wy += 34) {
      ctx.beginPath();
      ctx.moveTo(cam.x + ((wy * 7) % 160), wy);
      ctx.lineTo(cam.x + ((wy * 7) % 160) + 90, wy);
      ctx.stroke();
    }
    // Marina water (east).
    ctx.fillStyle = dusk ? '#1d3a5c' : '#2b7fb8';
    ctx.fillRect(City.MARINA_X, cam.y, vw, 1560 - cam.y);
    // Roads.
    ctx.fillStyle = dusk ? '#33383f' : '#3d434c';
    for (var i = 0; i < City.roadsV.length; i++) {
      ctx.fillRect(City.roadsV[i] - City.ROAD_W / 2, cam.y, City.ROAD_W, vh);
    }
    for (var j = 0; j < City.roadsH.length; j++) {
      ctx.fillRect(cam.x, City.roadsH[j] - City.ROAD_W / 2, vw, City.ROAD_W);
    }
    // Sidewalks.
    ctx.fillStyle = dusk ? '#4a4d4a' : '#9aa0a3';
    for (var i2 = 0; i2 < City.roadsV.length; i2++) {
      ctx.fillRect(City.roadsV[i2] - City.ROAD_W / 2 - City.WALK, cam.y, City.WALK, vh);
      ctx.fillRect(City.roadsV[i2] + City.ROAD_W / 2, cam.y, City.WALK, vh);
    }
    for (var j2 = 0; j2 < City.roadsH.length; j2++) {
      ctx.fillRect(cam.x, City.roadsH[j2] - City.ROAD_W / 2 - City.WALK, vw, City.WALK);
      ctx.fillRect(cam.x, City.roadsH[j2] + City.ROAD_W / 2, vw, City.WALK);
    }
    // Centre dashes.
    ctx.strokeStyle = dusk ? 'rgba(255,220,120,0.5)' : 'rgba(255,220,120,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    for (var i3 = 0; i3 < City.roadsV.length; i3++) {
      ctx.beginPath();
      ctx.moveTo(City.roadsV[i3], cam.y);
      ctx.lineTo(City.roadsV[i3], cam.y + vh);
      ctx.stroke();
    }
    for (var j3 = 0; j3 < City.roadsH.length; j3++) {
      ctx.beginPath();
      ctx.moveTo(cam.x, City.roadsH[j3]);
      ctx.lineTo(cam.x + vw, City.roadsH[j3]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Park.
    var pk = City.park;
    ctx.fillStyle = dusk ? '#3c5a3a' : '#4e8f4a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.strokeStyle = dusk ? '#6b7a5e' : '#c9b078';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pk.x + pk.w / 2, pk.y);
    ctx.lineTo(pk.x + pk.w / 2, pk.y + pk.h);
    ctx.moveTo(pk.x, pk.y + pk.h / 2);
    ctx.lineTo(pk.x + pk.w, pk.y + pk.h / 2);
    ctx.stroke();
    ctx.fillStyle = dusk ? '#2f4a2e' : '#3a7a3a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CORAL PARK', pk.x + pk.w / 2, pk.y + pk.h / 2 - 8);
    // Trees.
    for (var t = 0; t < City.trees.length; t++) {
      var tr = City.trees[t];
      ctx.fillStyle = tr.palm ? '#8a6a3b' : '#5a4632';
      ctx.fillRect(tr.x - 1, tr.y - 1, 3, 6);
      ctx.fillStyle = tr.palm ? '#5da85a' : (dusk ? '#2e5230' : '#2f7a33');
      ctx.beginPath(); ctx.arc(tr.x, tr.y - 3, tr.r, 0, 7); ctx.fill();
    }
    // Buildings.
    for (var b = 0; b < City.buildings.length; b++) {
      var bd = City.buildings[b];
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(bd.x + 5, bd.y + 6, bd.w, bd.h);
      ctx.fillStyle = dusk ? shade(bd.color, -40) : bd.color;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.fillStyle = bd.roof;
      ctx.fillRect(bd.x + 4, bd.y + 4, bd.w - 8, bd.h - 8);
      // Windows.
      ctx.fillStyle = dusk ? 'rgba(255,214,120,0.85)' : 'rgba(255,255,255,0.55)';
      for (var wx = bd.x + 10; wx < bd.x + bd.w - 8; wx += 16) {
        for (var wy2 = bd.y + 10; wy2 < bd.y + bd.h - 8; wy2 += 16) {
          ctx.fillRect(wx, wy2, 7, 6);
        }
      }
      if (bd.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(bd.x + bd.w / 2 - 6, bd.y - 12, 12, 12);
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath(); ctx.arc(bd.x + bd.w / 2, bd.y - 12, 3, 0, 7); ctx.fill();
      }
      if (bd.name) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bd.name, bd.x + bd.w / 2, bd.y + bd.h / 2 + 4);
      }
    }
    // Marina docks + boats.
    ctx.fillStyle = '#7a5c38';
    for (var d = 0; d < 4; d++) {
      ctx.fillRect(City.MARINA_X + 8, 240 + d * 300, 90, 10);
    }
    for (var bo = 0; bo < City.boats.length; bo++) {
      var bt = City.boats[bo];
      ctx.save();
      ctx.translate(bt.x, bt.y);
      ctx.rotate(bt.a);
      ctx.fillStyle = bt.color;
      roundRect(ctx, -bt.len / 2, -8, bt.len, 16, 7);
      ctx.fill();
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.restore();
    }
    // Beach umbrellas.
    ctx.fillStyle = '#ff6b6b';
    for (var u = 0; u < 8; u++) {
      var ux = 200 + u * 280, uy = 1690 + (u % 2) * 36;
      ctx.beginPath(); ctx.arc(ux, uy, 12, Math.PI, 0); ctx.fill();
      ctx.fillStyle = u % 2 ? '#4a90d9' : '#ff6b6b';
    }
    // Mission drops.
    if (w.missions && w.missions.active && w.missions.state && w.missions.state.drops) {
      for (var di = 0; di < w.missions.state.drops.length; di++) {
        var dr = w.missions.state.drops[di];
        if (dr.got) continue;
        var pulse = 1 + Math.sin(w.time * 5) * 0.2;
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath(); ctx.arc(dr.x, dr.y, 10 * pulse, 0, 7); ctx.fill();
        ctx.fillStyle = '#7a5c00';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', dr.x, dr.y + 4);
      }
    }
    // Mission target beacon.
    if (w.missions && w.missions.active && w.missions.state && w.missions.state.target) {
      var tg = w.missions.state.target;
      var pulse2 = 1 + Math.sin(w.time * 4) * 0.25;
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, 26 * pulse2, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(tg.x, tg.y - 34);
      ctx.lineTo(tg.x - 8, tg.y - 20);
      ctx.lineTo(tg.x + 8, tg.y - 20);
      ctx.closePath(); ctx.fill();
    }
    // Cars.
    for (var ci = 0; ci < w.cars.length; ci++) {
      var c = w.cars[ci];
      if (c.dead) continue;
      drawCar(ctx, c, dusk);
    }
    // Police cars are in w.police (kind police).
    for (var pi = 0; pi < w.police.length; pi++) {
      var pc = w.police[pi];
      if (pc.onFoot || pc.dead) continue;
      drawCar(ctx, pc, dusk);
    }
    // Pedestrians.
    for (var pe = 0; pe < w.peds.length; pe++) {
      var pd = w.peds[pe];
      drawPerson(ctx, pd.x, pd.y, pd.angle, pd.shirt, pd.skin, pd.stepPhase, pd.dead);
    }
    // Foot police.
    for (var pf = 0; pf < w.police.length; pf++) {
      var cf = w.police[pf];
      if (!cf.onFoot || cf.dead) continue;
      drawPerson(ctx, cf.x, cf.y, cf.angle, '#1c2f4d', '#e0ac69', w.time * 8, false);
      ctx.fillStyle = '#1c2f4d';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', cf.x, cf.y - 12);
    }
    // Bullets.
    ctx.fillStyle = '#ffe27a';
    for (var bi = 0; bi < w.bullets.length; bi++) {
      var bl = w.bullets[bi];
      ctx.fillRect(bl.x - 2, bl.y - 2, 4, 4);
    }
    // Player.
    var pl = w.player;
    if (!pl.dead && !pl.inCar) {
      var aim = pl.aimAngle !== undefined ? pl.aimAngle : pl.angle;
      drawPerson(ctx, pl.x, pl.y, pl.aimAngle !== undefined ? pl.aimAngle : pl.angle,
        '#e33e2b', '#f1c27d', pl.walkPhase, false);
      if (pl.weapon === 'pistol') {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pl.x + Math.cos(aim) * 8, pl.y + Math.sin(aim) * 8);
        ctx.lineTo(pl.x + Math.cos(aim) * 18, pl.y + Math.sin(aim) * 18);
        ctx.stroke();
      }
      if (pl.punchT > 0) {
        ctx.fillStyle = '#f1c27d';
        ctx.beginPath();
        ctx.arc(pl.x + Math.cos(aim) * 24, pl.y + Math.sin(aim) * 24, 5, 0, 7);
        ctx.fill();
      }
    }
    if (pl.dead) {
      drawPerson(ctx, pl.x, pl.y, pl.angle, '#e33e2b', '#f1c27d', 0, true);
    }
    // Dusk tint.
    if (dusk) {
      ctx.fillStyle = 'rgba(30,20,70,0.22)';
      ctx.fillRect(cam.x, cam.y, vw, vh);
    }
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  S.Render = { drawWorld: drawWorld, drawCar: drawCar, drawPerson: drawPerson, roundRect: roundRect };
})();
