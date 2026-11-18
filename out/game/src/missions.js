// missions.js — story: five jobs for Rico, fixer of Solmarina. Sequential, cash rewards.
// Each mission has stages; the active stage's target is the yellow marker.
import { addCash } from './player.js';
import { crimeCommitted, raiseWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { makeEnemy } from './combat.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Rico',
    brief: 'Rico needs a driver he can trust. Steal any parked car and bring it to the hideout at Casa Alba. Keep it clean — or don\'t.',
    reward: 300,
  },
  {
    id: 2, name: 'Salt in the Wound', giver: 'Rico',
    brief: 'A package of "sea salt" has to reach the marina before the tide turns. Drive to the Marina Solmarina docks. The PD patrols the coast road — stay sharp.',
    reward: 500,
  },
  {
    id: 3, name: 'The Tail', giver: 'Lena',
    brief: 'Lena thinks her ex is selling her out to the Coral Kings. Follow his grey Comet — stay between 80 and 220 metres. Too close and he spots you; too far and you lose him.',
    reward: 650,
  },
  {
    id: 4, name: 'Banco del Sol', giver: 'Rico',
    brief: 'The big one. Walk into Banco del Sol, grab the cash from the vault room, and get out. The Coral Kings guard it — and the alarm brings the whole PD down on you.',
    reward: 1500,
  },
  {
    id: 5, name: 'Last Tide', giver: 'Lena',
    brief: 'The Kings know it was you. Lose the heat and reach the Old Pier by the beach. If you make it, the boat is waiting — and so is your cut of the city.',
    reward: 2500,
  },
];

export function startMission(G, idx) {
  const m = MISSIONS[idx];
  if (!m) { G.mission = null; return; }
  G.missionIdx = idx;
  G.mission = { def: m, stage: 0, t: 0, target: null, tailCar: null, cashGrabbed: false, failT: 0 };
  G.msg = `NEW JOB — ${m.name}: ${m.brief}`;
  G.audio.missionOk();
  setupStage(G);
}

function setupStage(G) {
  const M = G.mission, L = G.city.landmarks;
  if (M.def.id === 1) {
    M.target = { x: L.hideout.x, y: L.hideout.y, label: 'Hideout — Casa Alba' };
  } else if (M.def.id === 2) {
    M.target = { x: L.marina.x, y: L.marina.y, label: 'Marina Solmarina' };
  } else if (M.def.id === 3) {
    // Spawn the target car driving a loop around the central blocks.
    const car = makeCar(1700, 1400, 0, { ai: 'mission', color: '#8a8a8a', name: 'Comet' });
    car.route = [
      { x: 1700, y: 1400 }, { x: 2600, y: 1400 }, { x: 2600, y: 2300 },
      { x: 1100, y: 2300 }, { x: 1100, y: 1400 },
    ];
    car.routeIdx = 0;
    G.cars.push(car);
    M.tailCar = car;
    M.target = { x: car.x, y: car.y, label: 'Follow the grey Comet', follow: car };
  } else if (M.def.id === 4) {
    M.target = { x: L.bank.x, y: L.bank.y, label: 'Banco del Sol — get inside' };
    // Guards inside the bank block.
    for (let i = 0; i < 4; i++) {
      G.enemies.push(makeEnemy(G, L.bank.x - 60 + i * 45, L.bank.y - 40 + (i % 2) * 80, { hp: 70, aggro: false }));
    }
  } else if (M.def.id === 5) {
    M.target = { x: L.pier.x, y: L.pier.y, label: 'Old Pier — escape!' };
    raiseWanted(G, 3, 'The Coral Kings tipped off the PD — 3 stars!');
  }
}

function completeMission(G) {
  const M = G.mission;
  addCash(G, M.def.reward, M.def.name);
  G.stats.missionsDone++;
  G.completedMissions.push(M.def.id);
  G.audio.missionOk();
  G.msg = `JOB DONE — ${M.def.name}: +$${M.def.reward}.`;
  // Clean up mission props.
  if (M.tailCar) { M.tailCar.wrecked = true; M.tailCar.ai = null; }
  G.mission = null;
  G.missionIdx++;
  if (G.missionIdx < MISSIONS.length) {
    G.nextMissionAt = G.time + 2;
  } else {
    G.state = 'win';
    G.msg = 'SOLMARINA IS YOURS. Every job done, every debt paid. The city never forgets a legend.';
  }
}

function failMission(G, reason) {
  G.audio.missionFail();
  G.msg = `JOB FAILED — ${reason}. Talk to Rico (press M) to try again.`;
  if (G.mission && G.mission.tailCar) { G.mission.tailCar.wrecked = true; G.mission.tailCar.ai = null; }
  G.mission = null;
  G.missionFailedIdx = G.missionIdx;
}

export function updateMissions(G, dt) {
  // Auto-start the next mission shortly after the previous one completes.
  if (!G.mission && G.missionIdx < MISSIONS.length && G.nextMissionAt && G.time >= G.nextMissionAt && G.state === 'play') {
    G.nextMissionAt = 0;
    startMission(G, G.missionIdx);
  }
  if (!G.mission) return;
  const M = G.mission, p = G.player, L = G.city.landmarks;
  M.t += dt;
  const dTarget = M.target ? Math.hypot(p.x - M.target.x, p.y - M.target.y) : 9999;

  if (M.def.id === 1) {
    // Need to arrive IN a car.
    if (dTarget < 70 && p.inCar) completeMission(G);
    else if (dTarget < 70 && !p.inCar) G.objectiveHint = 'You need to bring a CAR to the hideout.';
  } else if (M.def.id === 2) {
    if (dTarget < 70 && p.inCar) completeMission(G);
    else if (dTarget < 70) G.objectiveHint = 'The package is in the car — bring a car to the docks.';
  } else if (M.def.id === 3) {
    const tc = M.tailCar;
    if (!tc || tc.wrecked) { failMission(G, 'the Comet was destroyed'); return; }
    const d = Math.hypot(p.x - tc.x, p.y - tc.y);
    M.target.x = tc.x; M.target.y = tc.y;
    if (d < 70) {
      M.failT += dt;
      G.objectiveHint = 'TOO CLOSE — back off, he can see you!';
      if (M.failT > 3) { failMission(G, 'he spotted you'); return; }
    } else if (d > 320) {
      M.failT += dt;
      G.objectiveHint = 'You are LOSING him — get closer!';
      if (M.failT > 5) { failMission(G, 'you lost the tail'); return; }
    } else {
      M.failT = 0;
      G.objectiveHint = `Tail holding — stay in range. ${Math.ceil(60 - M.t)}s to go.`;
    }
    M.progress = Math.min(1, M.t / 60);
    if (M.t > 60) completeMission(G);
  } else if (M.def.id === 4) {
    if (M.stage === 0) {
      if (dTarget < 60 && !p.inCar) {
        M.stage = 1;
        M.target = { x: L.bank.x, y: L.bank.y, label: 'Grab the cash — vault room!' };
        for (const e of G.enemies) e.aggro = true;
        crimeCommitted(G, 2, 'The bank alarm is screaming!');
        G.msg = 'Inside! Grab the cash, then run.';
        G.pickups.push({ x: L.bank.x, y: L.bank.y, kind: 'vaultcash', t: 0 });
      } else if (dTarget < 60) G.objectiveHint = 'Get OUT of the car and walk in.';
    } else if (M.stage === 1) {
      if (M.cashGrabbed) {
        M.stage = 2;
        M.target = { x: L.hideout.x, y: L.hideout.y, label: 'Escape to the hideout!' };
        raiseWanted(G, 3, 'Every cop in Solmarina is coming!');
      }
    } else if (M.stage === 2) {
      if (dTarget < 70) completeMission(G);
    }
  } else if (M.def.id === 5) {
    if (dTarget < 70 && G.wanted === 0) completeMission(G);
    else if (dTarget < 70) G.objectiveHint = 'Lose the heat first — hide until the stars fade!';
  }
}

export function updateTailCar(G, dt) {
  // The mission target car cruises its loop slowly so the player can keep up.
  for (const car of G.cars) {
    if (car.ai !== 'mission' || !car.route) continue;
    const wp = car.route[car.routeIdx];
    const dx = wp.x - car.x, dy = wp.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 40) { car.routeIdx = (car.routeIdx + 1) % car.route.length; continue; }
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2 * dt, Math.min(2 * dt, diff));
    car.speed = 130;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }
}
