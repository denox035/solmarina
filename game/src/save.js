// SOLMARINA save: progress persists in localStorage — cash, missions, story
// state and the player's last position.
window.SOL = window.SOL || {};
(function () {
  var S = window.SOL;
  var KEY = 'solmarina-save-v1';

  function save(w) {
    try {
      var data = {
        cash: w.player.cash,
        hp: w.player.hp,
        missionsDone: w.player.missionsDone,
        missionIndex: w.missions.index,
        storyDone: w.player.storyDone,
        x: w.player.x, y: w.player.y,
        clock: w.clockMinutes
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function exists() {
    try { return !!window.localStorage.getItem(KEY); }
    catch (e) { return false; }
  }

  function clear() {
    try { window.localStorage.removeItem(KEY); } catch (e) {}
  }

  function applySave(w, data) {
    if (!data) return false;
    w.player.cash = data.cash;
    w.player.hp = data.hp;
    w.player.missionsDone = data.missionsDone || 0;
    w.missions.index = data.missionIndex || 0;
    w.player.storyDone = !!data.storyDone;
    if (data.x !== undefined && data.y !== undefined) {
      w.player.x = data.x; w.player.y = data.y;
    }
    if (data.clock !== undefined) w.clockMinutes = data.clock;
    return true;
  }

  S.Save = { save: save, load: load, exists: exists, clear: clear, applySave: applySave };
})();
