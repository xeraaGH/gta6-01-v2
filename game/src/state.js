// state.js — shared world state and small helpers for Porto Verde.
// Every system reads and writes this one object, so the modules stay decoupled.
export const G = {
  scene: null, camera: null, renderer: null,
  time: 0,            // seconds since boot
  dayTime: 10.2 * 3600, // seconds since midnight (10:12 AM start)
  dayLength: 600,     // full day/night cycle in seconds (game time)
  weather: 'clear',   // clear | rain | fog
  weatherTimer: 240,
  rain: null,
  paused: false,
  mode: 'title',      // title | play | dead | missionEnd
  player: null,       // filled by people.js
  cars: [],           // traffic + police + player cars
  peds: [],
  cops: [],
  heli: null,
  roadblocks: [],
  enemies: [],
  pickups: [],
  collectibles: [],
  mission: null,      // active mission runtime
  missionsDone: [],   // ids completed this session (save.js persists)
  cash: 500,
  standing: {},       // district -> 0..100
  wanted: 0,
  wantedHeat: 0,      // 0..1, drives decay and police aggression
  stats: { kills: 0, carsStolen: 0, racesWon: 0, fares: 0, packages: 0, shotsFired: 0 },
  race: null,         // active street race runtime
  taxi: null,         // active taxi fare runtime
  shot: null,         // screenshot staging mode (?shot=cover etc.)
  autostart: false,
  debug: false,
  city: null,         // city data from city.js (roads, districts, landmarks)
  sun: null, moon: null,
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  cameraMode: 'follow',
  notify: null,       // hud.js sets this to a toast function
  objective: '',
  radioStation: 0,
  radioOn: true,
  deadEye: 0,         // slow-mo timer
  nitro: 0,
  lead: 'dante',      // active playable lead: dante | lena
  leads: {
    dante: { name: 'Dante Reyes', perk: 'Dead Eye', perkKey: 'Q — Dead Eye (slow-mo)', color: 0x2e6f8e },
    lena: { name: 'Lena Vega', perk: 'Nitro', perkKey: 'Q — Nitro boost', color: 0xc23b6e },
  },
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a = 1, b) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Angle helpers: headings are radians, 0 = +Z (south), PI/2 = +X (east).
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function fmtClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24, m = Math.floor(seconds / 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
