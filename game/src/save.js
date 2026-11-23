// save.js — localStorage persistence for Porto Verde: cash, missions, standing,
// collectibles, stats, active lead and position. Saved on mission complete and
// every 20 seconds; loaded at boot when the player picks Continue.
import { G } from './state.js';

const KEY = 'portoverde-save-v1';

export function saveGame(silent = false) {
  if (!G.player) return;
  const data = {
    version: 1,
    cash: G.cash,
    missionsDone: G.missionsDone,
    standing: G.standing,
    stats: G.stats,
    lead: G.lead,
    x: G.player.x, z: G.player.z,
    health: G.player.health, armor: G.player.armor,
    dayTime: G.dayTime,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    if (!silent && G.notify) G.notify('Progress saved.', 'info');
  } catch (e) { /* storage unavailable */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) { return null; }
}

export function applySave(data) {
  G.cash = data.cash ?? 500;
  G.missionsDone = data.missionsDone || [];
  G.standing = data.standing || {};
  Object.assign(G.stats, data.stats || {});
  G.lead = data.lead || 'dante';
  G.dayTime = data.dayTime ?? G.dayTime;
  const p = G.player;
  if (p) {
    p.x = data.x ?? -40; p.z = data.z ?? 400;
    p.health = data.health ?? 100; p.armor = data.armor ?? 50;
    p.mesh.position.set(p.x, 0, p.z);
  }
}

export function hasSave() { return loadSave() !== null; }
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) {} }
