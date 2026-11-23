// missions.js — the story of Porto Verde: 10 missions, a $12,400 purse, plus
// side work: street races, taxi fares and hidden packages. Missions are data;
// the engine runs stages (goto / kill / survive / deliver / race / pickup).
import { G, rand, randi, choice, clamp, dist2 } from './state.js';
import { spawnEnemy, hurtPlayer } from './people.js';
import { spawnCar, raiseWanted } from './vehicles.js';

export const MISSIONS = [
  { id: 1, title: 'Welcome to Porto Verde', giver: 'Dante', district: 'marina', pay: 400,
    brief: 'Lena needs a ride to the Sol Casino. Steal any car and get her there — the city is yours now.',
    stages: [
      { type: 'goto', x: 40, z: 200, r: 12, text: 'Drive Lena to the Sol Casino (E to enter a car)' },
      { type: 'goto', x: -40, z: 400, r: 12, text: 'Drop Lena at the Marina Bay safehouse' },
    ] },
  { id: 2, title: 'The Dock Job', giver: 'Marisol', district: 'docks', pay: 800,
    brief: 'Marisol’s cargo is locked in a dock warehouse. Grab the crate and lose the dock guards.',
    stages: [
      { type: 'goto', x: -400, z: 200, r: 14, text: 'Reach the dock warehouse' },
      { type: 'kill', count: 3, x: -400, z: 200, text: 'Clear the dock guards (3)' },
      { type: 'goto', x: -40, z: 400, r: 12, text: 'Deliver the crate to the safehouse' },
    ] },
  { id: 3, title: 'Hot Wheels', giver: 'Lena', district: 'downtown', pay: 900,
    brief: 'A rival crew boosted Lena’s Fuego Sport. Steal it back from the Downtown garage and bring it home.',
    stages: [
      { type: 'goto', x: 80, z: -80, r: 12, text: 'Reach the Downtown garage' },
      { type: 'steal', x: 80, z: -80, text: 'Steal the Fuego Sport (E)' },
      { type: 'goto', x: -40, z: 400, r: 12, text: 'Bring the Fuego home — cops will chase' },
    ] },
  { id: 4, title: 'Barrio Brawl', giver: 'Dante', district: 'barrio', pay: 1000,
    brief: 'The Soles gang jumped our corner in Barrio Sol. Take it back, on foot, with whatever you carry.',
    stages: [
      { type: 'goto', x: 320, z: 0, r: 16, text: 'Reach the Barrio Sol corner' },
      { type: 'kill', count: 5, x: 320, z: 0, text: 'Run the Soles off the corner (5)' },
    ] },
  { id: 5, title: 'Midnight Run', giver: 'Marisol', district: 'port', pay: 1200,
    brief: 'A midnight delivery across town — no stops, no questions. The PD is out in force tonight.',
    stages: [
      { type: 'goto', x: -440, z: -400, r: 12, text: 'Pick up the package at Old Port' },
      { type: 'timed', x: 400, z: 320, r: 14, seconds: 75, text: 'Deliver to Marina Bay in 75 seconds!' },
    ] },
  { id: 6, title: 'The Stadium Heist', giver: 'Lena', district: 'docks', pay: 1800,
    brief: 'Verde Stadium’s gate money sits in a vault under the stands. In loud, out louder.',
    stages: [
      { type: 'goto', x: -360, z: 320, r: 18, text: 'Reach Verde Stadium' },
      { type: 'kill', count: 6, x: -360, z: 320, text: 'Fight through stadium security (6)' },
      { type: 'goto', x: -40, z: 400, r: 12, text: 'Escape to the safehouse with the take' },
    ] },
  { id: 7, title: 'Highway Kings', giver: 'Dante', district: 'hill', pay: 1500,
    brief: 'The Highway Kings race the beachfront avenue at dusk. Beat their champion or walk home.',
    stages: [
      { type: 'race', checkpoints: [[-400, 480], [0, 480], [400, 480], [400, 0], [0, -400]], text: 'Beat the Kings through 5 checkpoints' },
    ] },
  { id: 8, title: 'Casino Lights', giver: 'Marisol', district: 'downtown', pay: 2000,
    brief: 'The Sol Casino skimmed Marisol’s cut for the last time. Hit the vault room, then vanish.',
    stages: [
      { type: 'goto', x: 40, z: 200, r: 14, text: 'Enter the Sol Casino' },
      { type: 'kill', count: 7, x: 40, z: 200, text: 'Hold the vault room against casino muscle (7)' },
      { type: 'goto', x: -480, z: 520, r: 14, text: 'Escape to the lighthouse — 3 stars and climbing' },
    ] },
  { id: 9, title: 'Storm the Docks', giver: 'Lena', district: 'docks', pay: 2200,
    brief: 'The Soles brought in a shipment of guns. Sink it at the docks before it hits the street.',
    stages: [
      { type: 'goto', x: -440, z: 80, r: 16, text: 'Reach the container yard' },
      { type: 'kill', count: 8, x: -440, z: 80, text: 'Wipe out the Soles shipment crew (8)' },
      { type: 'survive', seconds: 30, text: 'Survive the PD response (30s)' },
    ] },
  { id: 10, title: 'King of Porto Verde', giver: 'Dante', district: 'downtown', pay: 2600,
    brief: 'One last job: the Soles’ boss, Rico Vane, is holed up in the Downtown tower. End it. Own the city.',
    stages: [
      { type: 'goto', x: 0, z: -40, r: 16, text: 'Reach the Downtown tower' },
      { type: 'kill', count: 10, x: 0, z: -40, text: 'Fight to the top — Vane’s crew (10)' },
      { type: 'goto', x: 0, z: 200, r: 20, text: 'Stand in the plaza as the city’s new king' },
    ] },
];

export const RACES = [
  { id: 'r1', name: 'Beachfront Sprint', checkpoints: [[-400, 480], [-100, 480], [200, 480], [480, 480]], prize: 600 },
  { id: 'r2', name: 'Downtown Loop', checkpoints: [[0, -160], [160, -160], [160, 160], [-160, 160], [-160, -160]], prize: 900 },
  { id: 'r3', name: 'Volcano Run', checkpoints: [[-400, -400], [0, -400], [400, -400], [400, 400]], prize: 1200 },
];

const PACKAGE_SPOTS = [
  [-520, -520], [520, -520], [-520, 480], [520, 480], [0, 0], [-240, -240], [240, 240],
  [-480, 120], [480, -120], [120, -480], [-120, 480], [400, -400], [-400, 400], [240, -240],
  [-160, 160], [160, -160], [0, 480], [-480, -480], [480, 400], [-40, -400],
];

export function startMission(id) {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def || G.missionsDone.includes(id)) return false;
  G.mission = {
    def, stageIdx: 0, killsLeft: 0, timer: 0, raceIdx: 0,
    marker: null, beacon: null, enemiesSpawned: false,
    onKill(t) { if (this.stage().type === 'kill') this.killsLeft = Math.max(0, this.killsLeft - 1); },
    stage() { return this.def.stages[this.stageIdx]; },
  };
  setStage(G.mission);
  if (G.notify) G.notify('MISSION: ' + def.title + ' — ' + def.brief, 'mission');
  if (window.__pv) window.__pv.missionStart();
  return true;
}

function setStage(m) {
  const s = m.stage();
  if (!s) { completeMission(m); return; }
  m.enemiesSpawned = false;
  m.killsLeft = s.count || 0;
  m.timer = s.seconds || 0;
  m.raceIdx = 0;
  if (s.type === 'kill' || s.type === 'race' || s.type === 'timed') {
    // nothing to spawn yet; kill stages spawn on arrival
  }
  G.objective = s.text;
  updateMarker(m);
}

function updateMarker(m) {
  if (m.marker) { G.scene.remove(m.marker); m.marker = null; }
  if (m.beacon) { G.scene.remove(m.beacon); m.beacon = null; }
  const s = m.stage();
  if (!s || s.type === 'kill' || s.type === 'survive') return;
  const pt = s.type === 'race' ? { x: s.checkpoints[0][0], z: s.checkpoints[0][1] } : s;
  const geo = new THREE.CylinderGeometry(6, 6, 0.4, 20);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7 });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(pt.x, 0.3, pt.z);
  G.scene.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 90, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35 }));
  beam.position.set(pt.x, 45, pt.z);
  G.scene.add(beam);
  m.marker = ring; m.beacon = beam;
}

export function updateMission(dt) {
  const m = G.mission;
  if (!m) return;
  const s = m.stage();
  if (!s) return;
  const p = G.player;
  if (!p || p.dead) return;

  if (s.type === 'goto' || s.type === 'timed' || s.type === 'steal') {
    const d = dist2(p.x, p.z, s.x, s.z);
    if (s.type === 'timed') {
      m.timer -= dt;
      G.objective = s.text + ' — ' + Math.ceil(m.timer) + 's left';
      if (m.timer <= 0) { failMission(m, 'Too slow — the deal went cold.'); return; }
    }
    if (s.type === 'steal') {
      if (p.inCar && p.car && p.car.name === 'Fuego Sport') { nextStage(m); return; }
      // the Fuego Sport is parked at the garage
      if (!m.targetCar) {
        m.targetCar = spawnCar(s.x + 4, s.z, 0, { name: 'Fuego Sport', color: 0xff2020, maxSpeed: 42 });
        m.targetCar.parked = true;
      }
      return;
    }
    if (d < s.r) {
      if (s.type === 'goto' && m.def.id === 5 && m.stageIdx === 0) raiseWanted(0.5);
      nextStage(m);
    }
  } else if (s.type === 'kill') {
    if (!m.enemiesSpawned) {
      m.enemiesSpawned = true;
      for (let i = 0; i < s.count; i++) {
        spawnEnemy(s.x + rand(-14, 14), s.z + rand(-14, 14), { missionId: m.def.id });
      }
      if (m.def.id === 10) raiseWanted(2);
      else if (m.def.id >= 6) raiseWanted(1);
    }
    G.objective = s.text.replace(/\(\d+\)/, '(' + m.killsLeft + ')');
    if (m.killsLeft <= 0 && G.enemies.filter((e) => e.missionId === m.def.id && !e.dead).length === 0) {
      nextStage(m);
    }
  } else if (s.type === 'survive') {
    m.timer += dt;
    G.objective = s.text + ' — ' + Math.ceil(s.seconds - m.timer) + 's';
    if (m.timer >= s.seconds) nextStage(m);
    if (Math.random() < dt * 0.3 && G.cops.length < 4) raiseWanted(0.2);
  } else if (s.type === 'race') {
    const cp = s.checkpoints[m.raceIdx];
    if (!cp) { nextStage(m); return; }
    const d = dist2(p.x, p.z, cp[0], cp[1]);
    G.objective = s.text + ' — checkpoint ' + (m.raceIdx + 1) + '/' + s.checkpoints.length;
    if (d < 16) {
      m.raceIdx++;
      if (m.raceIdx >= s.checkpoints.length) { nextStage(m); return; }
      updateMarker(m);
    }
    // rival racer car chases the same checkpoints
    if (!m.rival) {
      m.rival = spawnCar(p.x + 20, p.z - 10, 0, { name: 'Kings Racer', color: 0x111111, maxSpeed: 40, driver: 'rival' });
    }
    driveRival(m, dt);
  }
}

function driveRival(m, dt) {
  const r = m.rival;
  const s = m.stage();
  const cp = s.checkpoints[Math.min(m.raceIdx, s.checkpoints.length - 1)];
  const want = Math.atan2(cp[0] - r.x, cp[1] - r.z);
  const dh = ((want - r.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  r.heading += clamp(dh, -2 * dt, 2 * dt);
  r.speed = clamp(r.speed + 12 * dt, 0, 36);
  r.x += Math.sin(r.heading) * r.speed * dt;
  r.z += Math.cos(r.heading) * r.speed * dt;
  r.mesh.position.set(r.x, 0, r.z);
  r.mesh.rotation.y = r.heading;
}

function nextStage(m) {
  // clean up stage leftovers
  if (m.targetCar) { /* keep the stolen car: it is the player's now */ m.targetCar = null; }
  if (m.rival) {
    G.scene.remove(m.rival.mesh);
    const i = G.cars.indexOf(m.rival);
    if (i >= 0) G.cars.splice(i, 1);
    m.rival = null;
  }
  m.stageIdx++;
  if (m.stageIdx >= m.def.stages.length) completeMission(m);
  else setStage(m);
}

function completeMission(m) {
  const def = m.def;
  G.cash += def.pay;
  G.missionsDone.push(def.id);
  const d = G.city.districts.find((x) => x.id === def.district);
  if (d) {
    G.standing[def.id === 10 ? 'downtown' : def.district] =
      clamp((G.standing[def.district] || 0) + 18, 0, 100);
  }
  if (m.marker) G.scene.remove(m.marker);
  if (m.beacon) G.scene.remove(m.beacon);
  G.mission = null;
  G.objective = '';
  if (G.notify) G.notify('MISSION COMPLETE: ' + def.title + ' — +' + '$' + def.pay.toLocaleString() + '!', 'mission');
  if (window.__pv) window.__pv.missionComplete();
  // unlock next mission automatically as available
  const next = MISSIONS.find((x) => !G.missionsDone.includes(x.id));
  if (next) {
    setTimeout(() => {
      if (G.notify) G.notify('New mission available: ' + next.title + ' — press M to start.', 'info');
    }, 3000);
  } else if (G.notify) {
    G.notify('STORY COMPLETE — you are the King of Porto Verde!', 'mission');
  }
}

export function failMission(m, reason) {
  if (m.marker) G.scene.remove(m.marker);
  if (m.beacon) G.scene.remove(m.beacon);
  for (const e of G.enemies) if (e.missionId === m.def.id && !e.dead) { e.dead = true; G.scene.remove(e.mesh); }
  G.enemies = G.enemies.filter((e) => e.missionId !== m.def.id);
  if (m.rival) {
    G.scene.remove(m.rival.mesh);
    const i = G.cars.indexOf(m.rival);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.mission = null;
  G.objective = '';
  if (G.notify) G.notify('MISSION FAILED: ' + reason + ' Press M to retry.', 'dead');
}

export function nextAvailableMission() {
  return MISSIONS.find((m) => !G.missionsDone.includes(m.id));
}

// --- side activities ---
export function spawnCollectibles() {
  const geo = new THREE.OctahedronGeometry(0.9);
  const mat = new THREE.MeshBasicMaterial({ color: 0x39d0ff });
  for (const [x, z] of PACKAGE_SPOTS) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.6, z);
    G.scene.add(mesh);
    G.collectibles.push({ mesh, x, z, taken: false });
  }
}

export function updateCollectibles(dt) {
  const p = G.player;
  if (!p) return;
  for (const c of G.collectibles) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = 1.6 + Math.sin(G.time * 2 + c.x) * 0.3;
    if (dist2(p.x, p.z, c.x, c.z) < 3) {
      c.taken = true;
      G.scene.remove(c.mesh);
      G.cash += 250;
      G.stats.packages++;
      if (G.notify) G.notify('Hidden package found! +$250 (' + G.stats.packages + '/20)', 'info');
      if (window.__pv) window.__pv.cash();
    }
  }
}

export function startRace(id) {
  const def = RACES.find((r) => r.id === id);
  if (!def || G.race) return;
  G.race = { def, idx: 0, timer: 0, rival: null };
  G.objective = 'STREET RACE: ' + def.name + ' — checkpoint 1/' + def.checkpoints.length;
  if (G.notify) G.notify('Street race: ' + def.name + ' — first to the last checkpoint wins $' + def.prize + '!', 'race');
}

export function updateRace(dt) {
  const r = G.race;
  if (!r) return;
  const p = G.player;
  r.timer += dt;
  const cp = r.def.checkpoints[r.idx];
  if (!cp) return;
  const d = dist2(p.x, p.z, cp[0], cp[1]);
  G.objective = 'STREET RACE: ' + r.def.name + ' — checkpoint ' + (r.idx + 1) + '/' + r.def.checkpoints.length + ' — ' + r.timer.toFixed(1) + 's';
  if (d < 16) {
    r.idx++;
    if (r.idx >= r.def.checkpoints.length) {
      G.cash += r.def.prize;
      G.stats.racesWon++;
      if (G.notify) G.notify('RACE WON: ' + r.def.name + ' — +$' + r.def.prize + '!', 'race');
      if (window.__pv) window.__pv.missionComplete();
      G.race = null; G.objective = '';
      return;
    }
  }
  if (!r.rival) {
    r.rival = spawnCar(p.x + 15, p.z + 5, 0, { name: 'Street Rival', color: 0x8a2a5e, maxSpeed: 39, driver: 'rival' });
  }
  // rival follows checkpoints
  const rv = r.rival;
  const want = Math.atan2(cp[0] - rv.x, cp[1] - rv.z);
  const dh = ((want - rv.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  rv.heading += clamp(dh, -2 * dt, 2 * dt);
  rv.speed = clamp(rv.speed + 12 * dt, 0, 37);
  rv.x += Math.sin(rv.heading) * rv.speed * dt;
  rv.z += Math.cos(rv.heading) * rv.speed * dt;
  rv.mesh.position.set(rv.x, 0, rv.z);
  rv.mesh.rotation.y = rv.heading;
  // rival wins if it finishes first
  if (dist2(rv.x, rv.z, r.def.checkpoints[r.def.checkpoints.length - 1][0], r.def.checkpoints[r.def.checkpoints.length - 1][1]) < 16) {
    if (G.notify) G.notify('Race lost — the rival took the ' + r.def.name + ' purse.', 'dead');
    G.scene.remove(rv.mesh);
    const i = G.cars.indexOf(rv);
    if (i >= 0) G.cars.splice(i, 1);
    G.race = null; G.objective = '';
  }
}

export function startTaxi() {
  if (G.taxi || !G.player) return;
  const p = G.player;
  const tx = rand(-480, 480), tz = rand(-480, 480);
  G.taxi = { x: tx, z: tz, fare: randi(80, 240), timer: 60 };
  G.objective = 'TAXI: pick up the fare at the marker';
  if (G.notify) G.notify('Taxi fare: pick up the passenger — $' + G.taxi.fare + ' if you are quick.', 'info');
}

export function updateTaxi(dt) {
  const t = G.taxi;
  if (!t) return;
  const p = G.player;
  t.timer -= dt;
  if (t.timer <= 0) { G.taxi = null; G.objective = ''; if (G.notify) G.notify('The fare gave up waiting.', 'info'); return; }
  if (dist2(p.x, p.z, t.x, t.z) < 10) {
    G.cash += t.fare;
    G.stats.fares++;
    if (G.notify) G.notify('Fare delivered! +$' + t.fare, 'info');
    if (window.__pv) window.__pv.cash();
    G.taxi = null; G.objective = '';
  }
}
