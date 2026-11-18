// combat.js — fists, pistol, bullets, enemy gang members, pickups.
import { hurtPlayer } from './player.js';
import { crimeCommitted } from './police.js';
import { buildingAt } from './city.js';

export function fireWeapon(G) {
  const p = G.player;
  if (p.inCar || p.shootCd > 0) return;
  if (p.weapon === 'fists') {
    p.punchCd = 0.35;
    G.audio.punch();
    const reach = 34;
    const hx = p.x + Math.cos(p.angle) * reach, hy = p.y + Math.sin(p.angle) * reach;
    for (const e of G.enemies) {
      if (Math.hypot(e.x - hx, e.y - hy) < 26) damageEnemy(G, e, 18);
    }
    for (const c of G.cops) {
      if (c.kind === 'ped' && Math.hypot(c.x - hx, c.y - hy) < 26) {
        c.hp -= 18;
        if (c.hp <= 0) { G.cops.splice(G.cops.indexOf(c), 1); crimeCommitted(G, 2, 'You knocked out a cop!'); }
      }
    }
    return;
  }
  // Pistol.
  if (p.ammo <= 0) {
    G.msg = 'Click — out of ammo. Find a green ammo pickup.';
    G.audio.blip(140, 0.12, 'square', 0.15);
    p.shootCd = 0.4;
    return;
  }
  p.ammo--;
  p.shootCd = 0.22;
  G.stats.shotsFiredAt = G.time;
  G.audio.shot();
  G.bullets.push({
    x: p.x + Math.cos(p.angle) * 22, y: p.y + Math.sin(p.angle) * 22,
    angle: p.angle + (Math.random() - 0.5) * 0.03,
    speed: 780, life: 0.8, from: 'player', dmg: 34,
  });
  crimeCommitted(G, 1, 'Shots fired — someone called the PD.');
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0 || buildingAt(G.city, b.x, b.y);
    if (!dead) {
      if (b.from === 'player') {
        for (const e of G.enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < 18) { damageEnemy(G, e, b.dmg); dead = true; break; }
        }
        if (!dead) for (const c of G.cops) {
          const cx = c.x, cy = c.y;
          if (Math.hypot(cx - b.x, cy - b.y) < (c.kind === 'car' ? 26 : 16)) {
            if (c.kind === 'car') { c.hp -= b.dmg; if (c.hp <= 0) { c.wrecked = true; G.cops.splice(G.cops.indexOf(c), 1); G.stats.kills++; } }
            else { c.hp -= b.dmg; if (c.hp <= 0) { G.cops.splice(G.cops.indexOf(c), 1); G.stats.kills++; crimeCommitted(G, 2, 'You took down an officer!'); } }
            dead = true; break;
          }
        }
        if (!dead) for (const car of G.cars) {
          if (!car.player && !car.parked && Math.hypot(car.x - b.x, car.y - b.y) < 24) {
            car.hp -= b.dmg; if (car.hp <= 0) car.wrecked = true; dead = true; break;
          }
        }
      } else {
        // Enemy / cop bullets hurt the player (or their car).
        const p = G.player;
        const tx = p.inCar ? p.inCar.x : p.x, ty = p.inCar ? p.inCar.y : p.y;
        const r = p.inCar ? 26 : 16;
        if (Math.hypot(tx - b.x, ty - b.y) < r) {
          if (p.inCar) { p.inCar.hp -= b.dmg; if (p.inCar.hp <= 0) { p.inCar.wrecked = true; p.inCar = null; } }
          else hurtPlayer(G, b.dmg, 'shot');
          dead = true;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function damageEnemy(G, e, dmg) {
  e.hp -= dmg;
  e.aggro = true;
  if (e.hp <= 0) {
    G.enemies.splice(G.enemies.indexOf(e), 1);
    G.stats.kills++;
    G.player.cash += 25;
    G.floaters.push({ x: e.x, y: e.y - 20, text: '+$25', t: 0, color: '#7dff8a' });
    G.audio.pickup();
  }
}

export function makeEnemy(G, x, y, opts = {}) {
  return {
    x, y, angle: 0, hp: opts.hp || 60, speed: 120 + G.rnd() * 30,
    shootCd: 0.6 + G.rnd(), aggro: !!opts.aggro, guard: opts.guard || null,
    shirt: '#8a2a2a', walkPhase: G.rnd() * 10,
  };
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    e.walkPhase += dt * 6;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (!e.aggro && d > 420) continue; // dormant until the player is near
    e.aggro = true;
    e.angle = Math.atan2(dy, dx);
    if (d > 240) {
      const nx = e.x + Math.cos(e.angle) * e.speed * dt;
      const ny = e.y + Math.sin(e.angle) * e.speed * dt;
      if (!buildingAt(G.city, nx, ny)) { e.x = nx; e.y = ny; }
    } else if (d < 60) {
      // Point-blank: shove / punch the player.
      if (e.shootCd <= 0) { hurtPlayer(G, 9, 'gang'); e.shootCd = 0.8; }
    } else {
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 1.0 + G.rnd() * 0.5;
        G.bullets.push({
          x: e.x, y: e.y, angle: e.angle + (G.rnd() - 0.5) * 0.2,
          speed: 560, life: 0.9, from: 'enemy', dmg: 7,
        });
        G.audio.shot();
      }
    }
  }
}

export function spawnPickups(G) {
  // Health (red cross) and ammo (green box) scattered near landmarks.
  const spots = [
    G.city.landmarks.hideout, G.city.landmarks.garage, G.city.landmarks.marina,
    G.city.landmarks.beach, G.city.landmarks.market, G.city.landmarks.hotel,
  ];
  for (const s of spots) {
    G.pickups.push({ x: s.x + 60, y: s.y + 40, kind: 'health', t: 0 });
    G.pickups.push({ x: s.x - 60, y: s.y - 40, kind: 'ammo', t: 0 });
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.t += dt;
    if (p.inCar) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      if (pk.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + 50); G.msg = 'First-aid kit: +50 health.'; }
      else { p.ammo += 24; if (p.weapon === 'fists') p.weapon = 'pistol'; G.msg = 'Ammo picked up (+24). Pistol ready — click to shoot.'; }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}
