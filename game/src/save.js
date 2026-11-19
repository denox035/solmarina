// save.js — progress persists in localStorage: cash, jobs finished, the
// player's position and the clock. Busted or wasted, Mara keeps her cash.

const SAVE_KEY = 'solmarina-save-v1';

function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      cash: p.cash,
      completed: G.completedMissions || 0,
      lastCompleted: (G.lastCompleted === undefined || G.lastCompleted === null) ? -1 : G.lastCompleted,
      x: p.x, y: p.y,
      clockMin: G.clockMin || 8 * 60,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (e) { return null; }
}

function applySave(G, data) {
  if (!data) return;
  G.player.cash = data.cash;
  G.completedMissions = data.completed || 0;
  G.lastCompleted = data.lastCompleted >= 0 ? data.lastCompleted : null;
  G.player.x = clamp(data.x || 1280, 40, WORLD_W - 40);
  G.player.y = clamp(data.y || 840, 40, WORLD_H - 40);
  G.clockMin = data.clockMin || 8 * 60;
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* private mode */ }
}
