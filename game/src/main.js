// main.js — Porto Verde boot and game loop.
// Renders the city, drives the camera (third-person follow / driving chase cam),
// routes input, advances day/night + weather, autosaves, and exposes a small
// debug bridge (window.__pv) the maker uses to play-test headlessly.
import { G, clamp, rand } from './state.js';
import { buildCity, updateSky } from './city.js';
import { spawnTraffic, updateCars, exitCar } from './vehicles.js';
import { createPlayer, spawnPeds, updatePlayerOnFoot, updatePeds, updateEnemies, handleActionKeys, hurtPlayer } from './people.js';
import { updatePolice, updatePaySpray } from './police.js';
import { startMission, nextAvailableMission, updateMission, updateRace, updateTaxi, updateCollectibles, spawnCollectibles, startRace, startTaxi, RACES } from './missions.js';
import { initHud, updateHud, setScreen, showToast, showBanner } from './hud.js';
import { initAudio, resumeAudio, updateAudio, bindAudioHooks, nextStation } from './audio.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { applyShotMode } from './shots.js';

G.cameraYaw = Math.PI; // camera looks north by default
let camDist = 9, camHeight = 4.5;
let saveTimer = 0;
let weatherTimer = 200;
let helpVisible = false;

function boot() {
  const canvas = document.getElementById('game-canvas');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
  G.camera.position.set(0, 30, -60);

  buildCity();
  createPlayer(-40, 400); // Marina Bay safehouse
  spawnTraffic(22);
  spawnPeds(36);
  spawnCollectibles();
  initHud();
  bindAudioHooks();
  initAudio();
  applyShotMode();
  if (!G.shot) G.mode = 'title';
  if (G.autostart) startPlay(false);
  setScreen(G.mode === 'title' ? 'title' : 'play');
  if (hasSave()) {
    const el = document.getElementById('title-continue');
    if (el) el.style.display = 'block';
  }

  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', (e) => {
    G.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    resumeAudio();
    if (e.code === 'Enter') {
      if (G.mode === 'title') startPlay(false);
      else if (G.mode === 'dead') respawn();
    }
    if (e.code === 'KeyM') {
      if (G.mode === 'play' && !G.mission) {
        const next = nextAvailableMission();
        if (next) startMission(next.id);
        else showToast('Story complete — you own Porto Verde!', 'mission');
      }
    }
    if (e.code === 'KeyT' && G.mode === 'play') startTaxi();
    if (e.code === 'KeyR' && G.mode === 'play' && !G.race) startRace(RACES[Math.floor(Math.random() * RACES.length)].id);
    if (e.code === 'KeyN' && G.mode === 'play') nextStation();
    if (e.code === 'KeyH') toggleHelp();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (G.mode === 'play') { G.mode = 'pause'; setScreen('pause'); }
      else if (G.mode === 'pause') { G.mode = 'play'; setScreen('play'); }
    }
    if (e.code === 'KeyV') G.cameraMode = G.cameraMode === 'follow' ? 'far' : 'follow';
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  window.addEventListener('mousedown', (e) => { G.mouse.down = true; resumeAudio(); });
  window.addEventListener('mouseup', () => { G.mouse.down = false; });
  window.addEventListener('mousemove', (e) => {
    G.mouse.x = e.clientX; G.mouse.y = e.clientY;
    if (G.mode === 'play' && e.buttons === 2) G.cameraYaw -= e.movementX * 0.003;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.getElementById('title-start')?.addEventListener('click', () => startPlay(false));
  document.getElementById('title-continue')?.addEventListener('click', () => startPlay(true));
  document.getElementById('pause-resume')?.addEventListener('click', () => { G.mode = 'play'; setScreen('play'); });
  document.getElementById('pause-save')?.addEventListener('click', () => saveGame());
  document.getElementById('pause-quit')?.addEventListener('click', () => { saveGame(true); G.mode = 'title'; setScreen('title'); });
  document.getElementById('dead-respawn')?.addEventListener('click', () => respawn());

  // debug bridge for headless play-tests (not part of the game UI)
  window.__pv = Object.assign(window.__pv || {}, {
    state() {
      const p = G.player;
      return {
        mode: G.mode, cash: G.cash, wanted: G.wanted,
        player: p ? { x: +p.x.toFixed(1), z: +p.z.toFixed(1), health: p.health, inCar: p.inCar, weapon: p.weapon } : null,
        cops: G.cops.length, heli: !!G.heli, traffic: G.cars.filter((c) => c.driver === 'traffic').length,
        peds: G.peds.filter((e) => !e.dead).length, enemies: G.enemies.filter((e) => !e.dead).length,
        mission: G.mission ? { id: G.mission.def.id, stage: G.mission.stageIdx, title: G.mission.def.title } : null,
        missionsDone: G.missionsDone.slice(), objective: G.objective,
        dayTime: G.dayTime, weather: G.weather,
      };
    },
    press(code, ms = 120) {
      G.keys[code] = true;
      setTimeout(() => { G.keys[code] = false; }, ms);
    },
    teleport(x, z) {
      const p = G.player;
      if (p.car) { p.car.x = x; p.car.z = z; }
      p.x = x; p.z = z;
      p.mesh.position.set(x, 0, z);
    },
    setWanted(n) { G.wantedHeat = n; G.wanted = n; },
    startMission(id) { startMission(id); },
    nearestCar() {
      const p = G.player;
      let best = null, bd = 1e9;
      for (const c of G.cars) {
        if (c.isPlayer) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best ? { x: +best.x.toFixed(1), z: +best.z.toFixed(1), name: best.name, parked: best.parked, dist: +bd.toFixed(1) } : null;
    },
    errors: [],
  });
  window.addEventListener('error', (e) => { window.__pv.errors.push(String(e.message)); });

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const realDt = Math.min(0.5, (now - last) / 1000);
    G.realDt = realDt;
    let dt = Math.min(0.05, realDt);
    last = now;
    if (G.deadEye > 0) { G.deadEye -= dt; dt *= 0.35; }
    if (G.nitro > 0) G.nitro -= dt;
    G.time += dt;
    if (G.mode === 'play' && !G.paused) {
      updateSky(dt);
      updateWeather(dt);
      updatePlayerOnFoot(dt);
      updateCars(dt);
      updatePeds(dt);
      updateEnemies(dt);
      updatePolice(dt);
      updatePaySpray(dt);
      updateMission(dt);
      updateRace(dt);
      updateTaxi(dt);
      updateCollectibles(dt);
      handleActionKeys();
      updateCamera(dt);
      updateHud();
      updateAudio();
      saveTimer += dt;
      if (saveTimer > 20) { saveTimer = 0; saveGame(true); }
    } else if (G.mode === 'title') {
      updateSky(dt * 0.2);
      orbitTitleCamera(dt);
    } else if (G.mode === 'dead') {
      updateSky(dt);
      updateCamera(dt);
    }
    G.renderer.render(G.scene, G.camera);
  }
  requestAnimationFrame(loop);
  window.__pvReady = true;
}

function updateWeather(dt) {
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    weatherTimer = rand(180, 420);
    const r = Math.random();
    G.weather = r < 0.65 ? 'clear' : r < 0.85 ? 'rain' : 'fog';
  }
}

function updateCamera(dt) {
  const p = G.player;
  if (!p) return;
  const target = new THREE.Vector3(p.x, 0, p.z);
  let dist = p.inCar ? 13 : 9;
  let height = p.inCar ? 5.5 : 4.2;
  if (G.cameraMode === 'far') { dist *= 1.5; height *= 1.4; }
  // mouse-look: right-drag orbits; otherwise camera trails the player's heading
  const yaw = p.inCar ? p.heading : G.cameraYaw;
  const cx = target.x - Math.sin(yaw) * dist;
  const cz = target.z - Math.cos(yaw) * dist;
  const desired = new THREE.Vector3(cx, height, cz);
  G.camera.position.lerp(desired, Math.min(1, (G.realDt || 0.016) * 6));
  // keep the camera out of buildings
  if (G.camera.position.y < 1.2) G.camera.position.y = 1.2;
  G.camera.lookAt(target.x, p.inCar ? 1.6 : 1.4, target.z);
}

function orbitTitleCamera(dt) {
  const t = G.time * 0.05;
  G.camera.position.set(Math.sin(t) * 220, 90, Math.cos(t) * 220);
  G.camera.lookAt(0, 10, 0);
}

function startPlay(fromSave) {
  if (fromSave) {
    const data = loadSave();
    if (data) applySave(data);
  }
  G.mode = 'play';
  setScreen('play');
  initAudio(); resumeAudio();
  showBanner('PORTO VERDE', 'Two leads. One city. Ten missions. Own it.');
  if (!G.mission && G.missionsDone.length === 0) {
    showToast('Welcome to Porto Verde — press M to start your first mission.', 'info');
  }
}

function respawn() {
  const p = G.player;
  p.dead = false; p.health = 100; p.armor = 50;
  p.inCar = false; p.car = null;
  p.x = -40; p.z = 400;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.z = 0;
  G.wanted = 0; G.wantedHeat = 0;
  for (const c of [...G.cops]) { if (c.car) { G.scene.remove(c.car.mesh); } }
  G.cops.length = 0;
  if (G.heli) { G.scene.remove(G.heli.mesh); G.heli = null; }
  G.mode = 'play';
  setScreen('play');
  showToast('Back on your feet at the Marina Bay safehouse.', 'info');
}

function toggleHelp() {
  helpVisible = !helpVisible;
  const el = document.getElementById('help-overlay');
  if (el) el.style.display = helpVisible ? 'block' : 'none';
}

boot();
