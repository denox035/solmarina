// SOLMARINA missions: Mara Voss's story chain — six jobs across the city,
// each with an objective, a marker, a timer and a payout.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var City = S.City;

  function markerAt(x, y, label) { return { x: x, y: y, label: label }; }

  var MISSIONS = [
    {
      id: 'first-wheels', title: 'First Wheels', pay: 300,
      brief: 'Mara needs wheels. Steal any car and bring it to her garage.',
      start: function (w) {
        return { target: markerAt(City.garage.x + 60, City.garage.y + 35, "Mara's Garage"),
          needCar: true, done: false };
      },
      check: function (w, st) {
        return w.player.inCar && Math.hypot(w.player.x - st.target.x, w.player.y - st.target.y) < 90;
      }
    },
    {
      id: 'sunset-courier', title: 'Sunset Courier', pay: 500, time: 100,
      brief: 'A package for the Grand. Drive it to the casino before the clock runs out.',
      start: function (w) {
        return { target: markerAt(City.casino.x + 80, City.casino.y + 40, 'Solmarina Grand'),
          done: false };
      },
      check: function (w, st) {
        return Math.hypot(w.player.x - st.target.x, w.player.y - st.target.y) < 90;
      }
    },
    {
      id: 'marina-meet', title: 'Marina Meet', pay: 650, time: 120,
      brief: 'Pick up the courier at the marina, then lose the cops tailing you.',
      start: function (w) {
        return { target: markerAt(City.MARINA_X + 60, 720, 'Marina Docks'),
          phase: 0, done: false };
      },
      check: function (w, st) {
        if (st.phase === 0) {
          if (Math.hypot(w.player.x - st.target.x, w.player.y - st.target.y) < 80) {
            st.phase = 1;
            S.Police.addHeat(w.wanted, 50, 'marina meet');
            w.toast('Cops on you — lose them!', 3);
          }
          return false;
        }
        return w.wanted.stars === 0;
      }
    },
    {
      id: 'park-pickup', title: 'Park Pickup', pay: 450, time: 110,
      brief: 'Three drops hidden in Coral Park. Grab them all on foot — stay out of sight.',
      start: function (w) {
        var drops = [];
        for (var i = 0; i < 3; i++) {
          drops.push(markerAt(
            City.park.x + 40 + Math.random() * (City.park.w - 80),
            City.park.y + 40 + Math.random() * (City.park.h - 80), 'Drop ' + (i + 1)));
        }
        return { drops: drops, got: 0, done: false };
      },
      check: function (w, st) {
        for (var i = 0; i < st.drops.length; i++) {
          var d = st.drops[i];
          if (!d.got && Math.hypot(w.player.x - d.x, w.player.y - d.y) < 34) {
            d.got = true; st.got++;
            S.Audio.pickup();
            w.toast('Drop ' + st.got + '/3 collected', 2);
          }
        }
        return st.got >= 3;
      }
    },
    {
      id: 'downtown-getaway', title: 'Downtown Getaway', pay: 800, time: 120,
      brief: 'You tripped the Meridian alarm. Lose a 3-star wanted level — fast.',
      start: function (w) {
        S.Police.addHeat(w.wanted, 110, 'meridian alarm');
        return { target: markerAt(City.garage.x + 60, City.garage.y + 35, 'Lay low at the garage'),
          done: false };
      },
      check: function (w, st) {
        return w.wanted.stars === 0 &&
          Math.hypot(w.player.x - st.target.x, w.player.y - st.target.y) < 120;
      }
    },
    {
      id: 'solmarina-job', title: 'The Solmarina Job', pay: 2500, time: 180,
      brief: 'The case is in the Meridian Tower. Grab it, dodge a 4-star response, deliver it to the yacht.',
      start: function (w) {
        return { target: markerAt(City.tower.x, City.tower.y + 80, 'Meridian Tower'),
          phase: 0, done: false };
      },
      check: function (w, st) {
        if (st.phase === 0) {
          if (Math.hypot(w.player.x - st.target.x, w.player.y - st.target.y) < 80) {
            st.phase = 1;
            st.target = markerAt(City.MARINA_X + 80, 1200, 'The Yacht');
            S.Police.addHeat(w.wanted, 180, 'the job');
            w.toast('Got the case — run to the yacht!', 3);
          }
          return false;
        }
        return Math.hypot(w.player.x - st.target.x, w.player.y - st.target.y) < 90;
      }
    }
  ];

  function makeMissions() {
    return { index: 0, state: null, timer: 0, active: false, failed: false };
  }

  function startMission(w) {
    var m = w.missions;
    if (m.index >= MISSIONS.length) return false;
    var def = MISSIONS[m.index];
    m.state = def.start(w);
    m.timer = def.time || 0;
    m.active = true;
    m.failed = false;
    w.toast('Mission: ' + def.title + ' — ' + def.brief, 5);
    return true;
  }

  function missionStep(w, dt) {
    var m = w.missions;
    if (!m.active || !m.state) return;
    var def = MISSIONS[m.index];
    if (def.time) {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.active = false; m.failed = true;
        S.Audio.missionFail();
        w.toast('Mission failed: ' + def.title + ' — time ran out', 4);
        S.Events && S.Events.emit('missionFailed', def);
        return;
      }
    }
    if (def.check(w, m.state)) {
      m.active = false;
      w.player.cash += def.pay;
      w.player.missionsDone++;
      S.Audio.missionOk();
      w.toast('Mission complete: ' + def.title + '  +$' + def.pay, 4);
      S.Events && S.Events.emit('missionDone', def);
      m.index++;
      if (m.index >= MISSIONS.length) {
        w.player.storyDone = true;
        w.player.cash += 1000;
        w.toast('STORY COMPLETE — Solmarina is yours. +$1000 bonus', 6);
      }
      S.Save && S.Save.save(w);
    }
  }

  function currentDef(m) {
    return m.index < MISSIONS.length ? MISSIONS[m.index] : null;
  }

  S.Missions = {
    MISSIONS: MISSIONS, makeMissions: makeMissions,
    startMission: startMission, missionStep: missionStep, currentDef: currentDef
  };
})();
