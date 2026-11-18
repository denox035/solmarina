// save.js — localStorage persistence for SOLMARINA.
const KEY = 'solmarina-save-v1';

export function saveGame(G) {
  try {
    const data = {
      version: 1, savedAt: Date.now(),
      cash: Math.round(G.player.cash), hp: Math.round(G.player.hp),
      x: Math.round(G.player.x), y: Math.round(G.player.y),
      missionIdx: G.missionIdx, completed: G.completedMissions.slice(),
      wanted: G.wanted, kills: G.stats.kills, carsStolen: G.stats.carsStolen,
      missionsDone: G.stats.missionsDone, playSeconds: Math.round(G.stats.playSeconds),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.version !== 1) return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() { return !!loadGame(); }

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
