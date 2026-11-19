// missions.js — six jobs for Mara Voss, chained in order. Each mission has
// a briefing, a target point on the map, an optional timer, and a payout.
// Finish one to unlock the next; the last one is the Solmarina Job.

const MISSIONS = [
  {
    id: 1, name: 'First Wheels',
    brief: 'Mara needs wheels. Steal any car on the street and bring it to the Coral Park lot.',
    target: { x: 1280, y: 700 }, payout: 300, timer: 0,
    check: (G) => G.player.inCar ? 'done' : null,
  },
  {
    id: 2, name: 'Sunset Courier',
    brief: 'A package for the Sunset Pier. Drive it there before the sun sets — 90 seconds.',
    target: { x: 120, y: 960 }, payout: 600, timer: 90,
    check: (G) => (G.player.inCar && dist2(G.player.x, G.player.y, 120, 960) < 90 * 90) ? 'done' : null,
  },
  {
    id: 3, name: 'The Getaway',
    brief: 'The Grand tipped off the cops. Lose a 2-star wanted level — break line of sight and stay quiet.',
    target: null, payout: 800, timer: 0,
    start: (G) => { raiseWanted(G, 2); },
    check: (G) => G.wanted === 0 ? 'done' : null,
  },
  {
    id: 4, name: 'Dockside Deal',
    brief: 'Pick up the crate at Marina Docks, then drop it at the Shipyard. No questions.',
    target: { x: 2160, y: 1680 }, payout: 1000, timer: 150,
    start: (G) => {
      G.missionStops = [{ x: 2160, y: 1680 }, { x: 480, y: 1680 }];
      G.missionStop = 0;
    },
    check: (G) => {
      const stops = G.missionStops || [];
      const next = stops[G.missionStop || 0];
      if (!next) return 'done';
      if (dist2(G.player.x, G.player.y, next.x, next.y) < 100 * 100) {
        G.missionStop++;
        AudioSys.pickup();
        G.toast = next === stops[0] ? 'Crate picked up — now the Shipyard' : 'Drop complete';
        if (G.missionStop >= stops.length) return 'done';
      }
      return null;
    },
  },
  {
    id: 5, name: 'Grand Heist Prep',
    brief: 'The Solmarina Grand keeps a gold Comet out back. Steal that exact car.',
    target: { x: 1760, y: 1330 }, payout: 1500, timer: 0,
    start: (G) => {
      const car = makeCar(1760, 1330, 0, { color: '#f1c40f', name: 'Comet' });
      car.isTraffic = false;
      G.cars.push(car);
      G.missionCar = car;
    },
    check: (G) => (G.missionCar && G.player.inCar === G.missionCar) ? 'done' : null,
  },
  {
    id: 6, name: 'The Solmarina Job',
    brief: 'The big one: hit Meridian Tower, then the Grand, then vanish at the pier. Three stops, four minutes.',
    target: { x: 1440, y: 480 }, payout: 5000, timer: 240,
    check: (G) => {
      const stops = G.missionStops || [];
      const next = stops[G.missionStop || 0];
      if (!next) return 'done';
      if (dist2(G.player.x, G.player.y, next.x, next.y) < 100 * 100) {
        G.missionStop++;
        AudioSys.pickup();
        G.toast = 'Stop cleared — ' + (stops.length - G.missionStop) + ' to go';
        if (G.missionStop >= stops.length) return 'done';
      }
      return null;
    },
    start: (G) => {
      G.missionStops = [{ x: 1440, y: 480 }, { x: 1760, y: 1200 }, { x: 120, y: 960 }];
      G.missionStop = 0;
    },
  },
];

function missionTarget(G) {
  const m = G.mission;
  if (!m) return null;
  if (G.missionStops) {
    const stops = G.missionStops || [];
    return stops[G.missionStop || 0] || null;
  }
  return m.target;
}

function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  G.mission = def;
  G.missionTime = def.timer || 0;
  G.missionStop = 0;
  G.missionStops = null;
  G.missionCar = null;
  G.toast = def.name + ' — ' + def.brief;
  if (def.start) def.start(G);
  return true;
}

function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  if (m.timer > 0) {
    G.missionTime -= dt;
    if (G.missionTime <= 0) {
      G.missionTime = 0;
      G.mission = null;
      G.toast = 'Too slow — ' + m.name + ' failed. Press M to retry.';
      G.failedMission = MISSIONS.indexOf(m);
      AudioSys.busted();
      return;
    }
  }
  const result = m.check(G);
  if (result === 'done') {
    addCash(G.player, m.payout);
    AudioSys.cash();
    G.toast = m.name + ' complete — +$' + m.payout;
    G.completedMissions = (G.completedMissions || 0) + 1;
    G.mission = null;
    G.failedMission = null;
    G.lastCompleted = MISSIONS.indexOf(m);
  }
}

function nextMissionIndex(G) {
  if (G.failedMission !== null && G.failedMission !== undefined) return G.failedMission;
  if (G.lastCompleted === null || G.lastCompleted === undefined) return 0;
  return Math.min(G.lastCompleted + 1, MISSIONS.length - 1);
}
