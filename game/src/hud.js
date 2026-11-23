// hud.js — the on-screen HUD: cash, wanted stars, health/armor, clock, radio,
// objective banner, toasts, and the LIVE minimap (2D canvas: roads, player,
// police, mission marker, taxi and race checkpoints).
import { G, fmtCash, fmtClock, clamp } from './state.js';
import { districtAtPoint } from './city.js';

let els = {};
let minimap = null, mmCtx = null;
let toastTimer = null;

export function initHud() {
  els = {
    cash: document.getElementById('hud-cash'),
    stars: document.getElementById('hud-stars'),
    health: document.getElementById('hud-health-fill'),
    armor: document.getElementById('hud-armor-fill'),
    clock: document.getElementById('hud-clock'),
    district: document.getElementById('hud-district'),
    objective: document.getElementById('hud-objective'),
    speed: document.getElementById('hud-speed'),
    weapon: document.getElementById('hud-weapon'),
    radio: document.getElementById('hud-radio'),
    lead: document.getElementById('hud-lead'),
    toast: document.getElementById('hud-toast'),
    banner: document.getElementById('hud-banner'),
    missions: document.getElementById('hud-missions'),
    title: document.getElementById('title-screen'),
    pause: document.getElementById('pause-screen'),
    dead: document.getElementById('dead-screen'),
    stats: document.getElementById('hud-stats'),
  };
  minimap = document.getElementById('minimap');
  mmCtx = minimap.getContext('2d');
  G.notify = (msg, kind) => showToast(msg, kind);
}

export function showToast(msg, kind = 'info') {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.className = 'toast'; }, 4200);
}

export function showBanner(text, sub = '') {
  if (!els.banner) return;
  els.banner.innerHTML = '<div class="banner-title">' + text + '</div>' +
    (sub ? '<div class="banner-sub">' + sub + '</div>' : '');
  els.banner.className = 'banner show';
  setTimeout(() => { els.banner.className = 'banner'; }, 3600);
}

export function updateHud() {
  const p = G.player;
  if (!p) return;
  if (els.cash) els.cash.textContent = fmtCash(G.cash);
  if (els.stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < G.wanted ? '★' : '☆';
    els.stars.textContent = s;
    els.stars.style.color = G.wanted > 0 ? '#ff4040' : '#888';
  }
  if (els.health) els.health.style.width = clamp(p.health, 0, 100) + '%';
  if (els.armor) els.armor.style.width = clamp(p.armor, 0, 100) + '%';
  if (els.clock) els.clock.textContent = fmtClock(G.dayTime) + (G.weather !== 'clear' ? ' · ' + G.weather.toUpperCase() : '');
  if (els.district) {
    const d = districtAtPoint(p.x, p.z);
    const st = G.standing[d.id] || 0;
    els.district.textContent = d.name + (st > 0 ? ' · standing ' + Math.round(st) : '');
  }
  if (els.objective) {
    els.objective.textContent = G.objective || (G.mission ? '' : 'Press M for the next mission · T taxi · R race · H help');
    els.objective.style.display = G.objective ? 'block' : 'block';
  }
  if (els.speed) {
    els.speed.textContent = p.inCar && p.car ? Math.round(Math.abs(p.car.speed) * 3.6) + ' km/h' : '';
  }
  if (els.weapon) {
    els.weapon.textContent = p.inCar ? '🚗 ' + (p.car ? p.car.name : '') : (p.weapon.toUpperCase() + ' · ∞'.replace('∞', p.ammo[p.weapon]));
  }
  if (els.radio) {
    const stations = ['RADIO SOL 98.5', 'VERDE FM 101.1', 'DOCK ROCK 88.2'];
    els.radio.textContent = G.radioOn ? '♪ ' + stations[G.radioStation] : '♪ radio off';
  }
  if (els.lead) {
    const l = G.leads[G.lead];
    els.lead.textContent = l.name + ' · ' + l.perk + ' (Q)';
  }
  if (els.missions) {
    const done = G.missionsDone.length;
    els.missions.textContent = 'Missions ' + done + '/10 · Races ' + G.stats.racesWon + ' · Packages ' + G.stats.packages + '/20';
  }
  drawMinimap();
}

function drawMinimap() {
  if (!mmCtx || !G.city) return;
  const S = 220, half = 620;
  const ctx = mmCtx;
  const p = G.player;
  ctx.clearRect(0, 0, S, S);
  // ocean / beach / land
  ctx.fillStyle = '#1e6f8e'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#3a5a3a';
  const landY = ((480 + half) / (half * 2)) * S;
  ctx.fillRect(0, 0, S, landY);
  ctx.fillStyle = '#e6cf9a';
  ctx.fillRect(0, landY, S, 6);
  // districts
  for (const d of G.city.districts) {
    ctx.fillStyle = d.color + '55';
    ctx.fillRect(((d.x0 + half) / (half * 2)) * S, ((d.z0 + half) / (half * 2)) * S,
      ((d.x1 - d.x0) / (half * 2)) * S, ((d.z1 - d.z0) / (half * 2)) * S);
  }
  // roads
  ctx.strokeStyle = '#33363b'; ctx.lineWidth = 2;
  for (const r of G.city.roads) {
    ctx.beginPath();
    if (r.axis === 'x') {
      ctx.moveTo(0, ((r.at + half) / (half * 2)) * S);
      ctx.lineTo(S, ((r.at + half) / (half * 2)) * S);
    } else {
      ctx.moveTo(((r.at + half) / (half * 2)) * S, 0);
      ctx.lineTo(((r.at + half) / (half * 2)) * S, S);
    }
    ctx.stroke();
  }
  const px = ((p.x + half) / (half * 2)) * S;
  const py = ((p.z + half) / (half * 2)) * S;
  const dot = (x, z, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // mission marker / race checkpoint / taxi
  const m = G.mission;
  if (m && m.stage()) {
    const s = m.stage();
    if (s.x !== undefined) dot(s.x, s.z, '#ffd23e', 5);
    else if (s.type === 'race') dot(s.checkpoints[m.raceIdx][0], s.checkpoints[m.raceIdx][1], '#ffd23e', 5);
  }
  if (G.race) dot(G.race.def.checkpoints[G.race.idx][0], G.race.def.checkpoints[G.race.idx][1], '#ff7a2e', 5);
  if (G.taxi) dot(G.taxi.x, G.taxi.z, '#39d0ff', 4);
  // cops (red/blue flashing)
  for (const c of G.cops) {
    if (c.car) dot(c.car.x, c.car.z, Math.floor(G.time * 6) % 2 === 0 ? '#ff2020' : '#2040ff', 3.5);
  }
  if (G.heli) dot(G.heli.x, G.heli.z, '#ff2020', 4);
  // enemies
  for (const e of G.enemies) if (!e.dead) dot(e.x, e.z, '#ff4040', 3);
  // collectibles
  for (const c of G.collectibles) if (!c.taken) dot(c.x, c.z, '#39d0ff', 2);
  // player: white arrow rotated to heading
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // north indicator
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', S - 14, 14);
}

export function setScreen(name) {
  // name: title | play | pause | dead
  if (els.title) els.title.style.display = name === 'title' ? 'flex' : 'none';
  if (els.pause) els.pause.style.display = name === 'pause' ? 'flex' : 'none';
  if (els.dead) els.dead.style.display = name === 'dead' ? 'flex' : 'none';
  if (els.stats && name === 'dead') {
    els.stats.innerHTML = 'Cash ' + fmtCash(G.cash) + ' · Missions ' + G.missionsDone.length + '/10 · Kills ' + G.stats.kills +
      ' · Cars stolen ' + G.stats.carsStolen + '<br>Press ENTER to respawn at the Marina Bay safehouse.';
  }
}
