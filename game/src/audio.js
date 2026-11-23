// audio.js — all sound is synthesized with WebAudio: engine hum, sirens, gunshots,
// crashes, cash jingles, mission stingers, and three procedural radio stations.
// No audio files are loaded, so the game stays fully offline.
import { G } from './state.js';

let ctx = null, master = null, engineOsc = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenLFO = null;
let radioTimer = null, radioStep = 0;
const STATIONS = [
  { name: 'RADIO SOL 98.5', bpm: 112, scale: [0, 3, 5, 7, 10], wave: 'triangle', base: 110 },
  { name: 'VERDE FM 101.1', bpm: 92, scale: [0, 2, 4, 7, 9], wave: 'sawtooth', base: 98 },
  { name: 'DOCK ROCK 88.2', bpm: 140, scale: [0, 3, 5, 6, 10], wave: 'square', base: 82 },
];

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    // engine hum
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    // two-tone siren
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    sirenLFO = ctx.createOscillator();
    sirenLFO.frequency.value = 1.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 280;
    sirenLFO.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenLFO.start();
    startRadio();
  } catch (e) { /* audio unavailable: game stays silent */ }
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

function blip(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol = 0.3, filterFreq = 1200) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

function jingle(notes, step = 0.11, type = 'triangle', vol = 0.22) {
  notes.forEach((n, i) => blip(n, step * 1.4, type, vol, i * step));
}

export function updateAudio() {
  if (!ctx) return;
  const p = G.player;
  if (p && p.inCar && p.car) {
    const sp = Math.abs(p.car.speed);
    engineOsc.frequency.value = 50 + sp * 4.2;
    engineGain.gain.value = 0.05 + Math.min(0.1, sp * 0.002);
  } else {
    engineGain.gain.value = 0;
  }
  if (sirenGain) sirenGain.gain.value = G.wanted > 0 && G.cops.length > 0 ? 0.045 : 0;
}

function startRadio() {
  if (!ctx || radioTimer) return;
  radioTimer = setInterval(() => {
    if (!ctx || !G.radioOn || G.mode !== 'play') return;
    const st = STATIONS[G.radioStation];
    const beat = 60 / st.bpm / 2;
    const scale = st.scale;
    const idx = radioStep % 16;
    const note = scale[Math.floor(Math.random() * scale.length)] + 12 * (idx % 4 === 0 ? 1 : 0);
    const freq = st.base * Math.pow(2, note / 12);
    blip(freq, beat * 0.9, st.wave, 0.05);
    if (idx % 4 === 0) blip(st.base / 2, beat * 1.8, 'sine', 0.09);
    radioStep++;
  }, 260);
}

export function nextStation() {
  G.radioStation = (G.radioStation + 1) % STATIONS.length;
  radioStep = 0;
  if (G.notify) G.notify('♪ ' + STATIONS[G.radioStation].name, 'info');
}

// Sound-effect hooks called from the game systems (window.__pv bridge).
export function bindAudioHooks() {
  window.__pv = window.__pv || {};
  window.__pv.gunshot = (distant) => noiseBurst(0.14, distant ? 0.12 : 0.3, distant ? 700 : 2400);
  window.__pv.punch = () => noiseBurst(0.08, 0.25, 500);
  window.__pv.crash = () => noiseBurst(0.3, 0.35, 900);
  window.__pv.explode = () => { noiseBurst(0.8, 0.5, 600); blip(60, 0.7, 'sine', 0.4); };
  window.__pv.hurt = () => blip(180, 0.15, 'sawtooth', 0.18);
  window.__pv.cash = () => jingle([880, 1174, 1568], 0.07, 'sine', 0.18);
  window.__pv.missionStart = () => jingle([392, 523, 659], 0.12, 'triangle', 0.2);
  window.__pv.missionComplete = () => jingle([523, 659, 784, 1046], 0.13, 'triangle', 0.24);
  window.__pv.wasted = () => jingle([330, 262, 196, 131], 0.25, 'sawtooth', 0.2);
  window.__pv.siren = (on) => { if (sirenGain) sirenGain.gain.value = on ? 0.045 : 0; };
  window.__pv.ability = () => jingle([660, 880, 1320], 0.06, 'square', 0.12);
  window.__pv.carDoor = () => { blip(300, 0.08, 'square', 0.12); noiseBurst(0.06, 0.1, 800); };
}
