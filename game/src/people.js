// people.js — the two leads on foot, pedestrians, and combat.
// Third-person on-foot controls (WASD + mouse aim), punching, shooting, health/armor.
import { G, rand, randi, choice, clamp, angDiff, dist2 } from './state.js';
import { snapToRoad } from './city.js';
import { nearestCar, stealCar, exitCar, raiseWanted } from './vehicles.js';

const SHIRT_COLORS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0xd84ab8, 0x7a4ad8, 0xe8e8e8, 0x2a2a2a];

export function makePersonMesh(shirt, pants = 0x2a2f3a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 1.78; head.castShadow = true; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  for (const s of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.75, 6), legMat);
    leg.position.set(s, 0.38, 0); g.add(leg);
  }
  for (const s of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: shirt }));
    arm.position.set(s, 1.15, 0); g.add(arm);
  }
  return g;
}

export function createPlayer(x, z) {
  const lead = G.leads[G.lead];
  const mesh = makePersonMesh(lead.color, 0x222222);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  G.player = {
    mesh, x, z, heading: 0, speed: 0,
    health: 100, armor: 50, inCar: false, car: null,
    weapon: 'pistol', ammo: { pistol: 120, smg: 90, rifle: 60 },
    aim: false, shootCd: 0, punchCd: 0, dead: false,
    walkPhase: 0,
  };
  return G.player;
}

export function spawnPeds(n = 36) {
  for (let i = 0; i < n; i++) {
    const x = rand(-520, 520), z = rand(-520, 520);
    const s = snapToRoad(x, z);
    const mesh = makePersonMesh(choice(SHIRT_COLORS));
    mesh.position.set(s.x + rand(-6, 6), 0, s.z + rand(-6, 6));
    G.scene.add(mesh);
    G.peds.push({
      mesh, x: mesh.position.x, z: mesh.position.z,
      heading: rand(0, Math.PI * 2), speed: rand(1.2, 2.2),
      target: null, fleeing: false, dead: false, walkPhase: rand(0, 6),
    });
  }
}

export function updatePlayerOnFoot(dt) {
  const p = G.player;
  if (!p || p.dead || p.inCar) return;
  const k = G.keys;
  const camYaw = G.cameraYaw;
  let mx = 0, mz = 0;
  if (k['KeyW'] || k['ArrowUp']) mz += 1;
  if (k['KeyS'] || k['ArrowDown']) mz -= 1;
  if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
  if (k['KeyD'] || k['ArrowRight']) mx += 1;
  const run = k['ShiftLeft'] || k['ShiftRight'];
  const speed = run ? 9 : 4.6;
  // movement relative to camera yaw
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let vx = (fx * mz + rx * mx), vz = (fz * mz + rz * mx);
  const len = Math.hypot(vx, vz);
  if (len > 0) { vx /= len; vz /= len; }
  p.x += vx * speed * dt;
  p.z += vz * speed * dt;
  p.x = clamp(p.x, -580, 580); p.z = clamp(p.z, -580, 575);
  // building collision
  for (const b of G.city.buildings) {
    if (Math.abs(p.x - b.x) < b.w / 2 + 0.6 && Math.abs(p.z - b.z) < b.d / 2 + 0.6) {
      const dx = p.x - b.x, dz = p.z - b.z;
      const px = b.w / 2 + 0.6 - Math.abs(dx), pz = b.d / 2 + 0.6 - Math.abs(dz);
      if (px < pz) p.x = b.x + Math.sign(dx || 1) * (b.w / 2 + 0.6);
      else p.z = b.z + Math.sign(dz || 1) * (b.d / 2 + 0.6);
    }
  }
  // face movement direction, or aim direction when aiming
  if (G.mouse.down || k['KeyF']) {
    p.heading = camYaw + Math.PI;
  } else if (len > 0) {
    const want = Math.atan2(vx, vz);
    p.heading += angDiff(p.heading, want) * Math.min(1, dt * 12);
  }
  p.walkPhase += dt * (len > 0 ? speed * 1.6 : 0);
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  p.mesh.rotation.x = len > 0 ? Math.sin(p.walkPhase) * 0.05 : 0;
  // shooting
  p.shootCd -= dt; p.punchCd -= dt;
  if (G.mouse.down && p.shootCd <= 0 && p.ammo[p.weapon] > 0) {
    shoot(p);
  }
  if (k['KeyF'] && p.punchCd <= 0) {
    p.punchCd = 0.45;
    punch(p);
  }
}

function shoot(p) {
  const rate = p.weapon === 'smg' ? 0.09 : p.weapon === 'rifle' ? 0.22 : 0.3;
  p.shootCd = rate;
  p.ammo[p.weapon]--;
  G.stats.shotsFired++;
  raiseWanted(0.15);
  if (window.__pv) window.__pv.gunshot();
  // ray from camera through screen centre
  const origin = new THREE.Vector3(p.x, 1.5, p.z);
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const spread = p.weapon === 'smg' ? 0.06 : 0.02;
  dir.x += rand(-spread, spread); dir.z += rand(-spread, spread); dir.normalize();
  // tracer
  const end = origin.clone().addScaledVector(dir, 60);
  const tracer = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([origin, end]),
    new THREE.LineBasicMaterial({ color: 0xffe9a0 }));
  G.scene.add(tracer);
  setTimeout(() => G.scene.remove(tracer), 60);
  // hit enemies / peds / cops within a cone
  let best = null, bd = 60;
  const targets = [...G.enemies, ...G.peds.filter((e) => !e.dead), ...G.cops.map((c) => c.ped).filter(Boolean)];
  for (const t of targets) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 60) continue;
    const dot = (dx * dir.x + dz * dir.z) / (d || 1);
    if (dot > 0.94 && d < bd) { bd = d; best = t; }
  }
  if (best) {
    const dmg = p.weapon === 'rifle' ? 55 : p.weapon === 'smg' ? 22 : 34;
    hurtTarget(best, dmg, p);
  }
  // also hit police cars
  for (const c of G.cops) {
    if (!c.car) continue;
    const dx = c.car.x - p.x, dz = c.car.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 60) continue;
    const dot = (dx * dir.x + dz * dir.z) / (d || 1);
    if (dot > 0.95) { c.car.health -= 20; if (c.car.health <= 0) destroyCopCar(c); }
  }
}

function punch(p) {
  let best = null, bd = 2.2;
  for (const t of [...G.enemies, ...G.peds.filter((e) => !e.dead)]) {
    const d = dist2(p.x, p.z, t.x, t.z);
    if (d < bd) { bd = d; best = t; }
  }
  if (best) {
    hurtTarget(best, 25, p);
    if (window.__pv) window.__pv.punch();
  }
}

export function hurtTarget(t, dmg, attacker) {
  t.health = (t.health ?? 100) - dmg;
  if (t.health <= 0 && !t.dead) {
    t.dead = true;
    if (t.mesh) {
      t.mesh.rotation.z = Math.PI / 2;
      t.mesh.position.y = 0.3;
    }
    if (t.isEnemy) {
      G.stats.kills++;
      raiseWanted(0.3);
      if (G.mission) G.mission.onKill?.(t);
    } else if (t.isCopPed) {
      G.stats.kills++;
      raiseWanted(1.2);
    } else {
      // civilian down
      raiseWanted(1.5);
      if (G.notify) G.notify('A civilian is down — witnesses called the cops!', 'wanted');
    }
    // nearby peds flee
    for (const pd of G.peds) {
      if (!pd.dead && dist2(pd.x, pd.z, t.x, t.z) < 40) pd.fleeing = true;
    }
  }
}

function destroyCopCar(c) {
  c.car.wrecked = true;
  c.car.mesh.traverse((m) => { if (m.isMesh && m.material.color) m.material.color.multiplyScalar(0.35); });
  if (window.__pv) window.__pv.explode(c.car.x, c.car.z);
  c.car = null;
  G.stats.kills++;
}

export function updatePeds(dt) {
  for (const pd of G.peds) {
    if (pd.dead) continue;
    if (!pd.target || dist2(pd.x, pd.z, pd.target.x, pd.target.z) < 3) {
      const s = snapToRoad(pd.x + rand(-60, 60), pd.z + rand(-60, 60));
      pd.target = { x: clamp(s.x + rand(-6, 6), -560, 560), z: clamp(s.z + rand(-6, 6), -560, 560) };
    }
    const p = G.player;
    let tx = pd.target.x, tz = pd.target.z;
    let speed = pd.speed;
    if (pd.fleeing && p) {
      const a = Math.atan2(pd.x - p.x, pd.z - p.z);
      tx = pd.x + Math.sin(a) * 40; tz = pd.z + Math.cos(a) * 40;
      speed = 5.5;
      if (dist2(pd.x, pd.z, p.x, p.z) > 60) pd.fleeing = false;
    }
    const want = Math.atan2(tx - pd.x, tz - pd.z);
    pd.heading += angDiff(pd.heading, want) * Math.min(1, dt * 6);
    pd.x += Math.sin(pd.heading) * speed * dt;
    pd.z += Math.cos(pd.heading) * speed * dt;
    pd.walkPhase += dt * speed * 2;
    pd.mesh.position.set(pd.x, Math.abs(Math.sin(pd.walkPhase)) * 0.06, pd.z);
    pd.mesh.rotation.y = pd.heading;
  }
}

// Enemies: rival gang members for shootout missions.
export function spawnEnemy(x, z, opts = {}) {
  const mesh = makePersonMesh(opts.shirt ?? 0x8e2a2a, 0x1a1a1a);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const e = {
    mesh, x, z, heading: rand(0, Math.PI * 2), health: 100,
    isEnemy: true, dead: false, shootCd: rand(0.5, 1.5),
    weapon: opts.weapon || 'pistol', missionId: opts.missionId || null,
  };
  G.enemies.push(e);
  return e;
}

export function updateEnemies(dt) {
  const p = G.player;
  if (!p || p.dead) return;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist2(e.x, e.z, p.x, p.z);
    e.shootCd -= dt;
    if (d < 42) {
      // face and shoot at the player
      const want = Math.atan2(p.x - e.x, p.z - e.z);
      e.heading += angDiff(e.heading, want) * Math.min(1, dt * 8);
      if (e.shootCd <= 0 && d < 38) {
        e.shootCd = rand(0.9, 1.8);
        if (window.__pv) window.__pv.gunshot(true);
        const hitChance = clamp(0.42 - d / 120, 0.08, 0.42);
        if (Math.random() < hitChance) hurtPlayer(9 + randi(0, 8));
        // tracer from enemy
        const o = new THREE.Vector3(e.x, 1.5, e.z);
        const end = new THREE.Vector3(p.x, 1.3, p.z);
        const tr = new THREE.Line(new THREE.BufferGeometry().setFromPoints([o, end]),
          new THREE.LineBasicMaterial({ color: 0xff9a7a }));
        G.scene.add(tr);
        setTimeout(() => G.scene.remove(tr), 70);
      }
    } else if (d < 120) {
      // close in on foot
      const want = Math.atan2(p.x - e.x, p.z - e.z);
      e.heading += angDiff(e.heading, want) * Math.min(1, dt * 6);
      e.x += Math.sin(e.heading) * 3.4 * dt;
      e.z += Math.cos(e.heading) * 3.4 * dt;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
  }
}

export function hurtPlayer(amt) {
  const p = G.player;
  if (!p || p.dead) return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amt * 0.6);
    p.armor -= absorbed; amt -= absorbed;
  }
  p.health -= amt;
  if (window.__pv) window.__pv.hurt();
  if (p.health <= 0) {
    p.dead = true;
    p.health = 0;
    G.mode = 'dead';
    if (G.notify) G.notify('WASTED — the crew scraped you off the asphalt.', 'dead');
    if (window.__pv) window.__pv.wasted();
  }
}

// E key: enter/exit nearest car. C: switch lead (on foot). Q: crew ability.
export function handleActionKeys() {
  const p = G.player;
  if (!p || p.dead || G.mode !== 'play') return;
  if (G.keys['KeyE']) {
    G.keys['KeyE'] = false;
    if (p.inCar) exitCar();
    else {
      const car = nearestCar(p.x, p.z, 6);
      if (car) stealCar(car);
      else if (G.notify) G.notify('No car close enough — find one on the street.', 'info');
    }
  }
  if (G.keys['KeyC']) {
    G.keys['KeyC'] = false;
    if (!p.inCar) switchLead();
  }
  if (G.keys['KeyQ']) {
    G.keys['KeyQ'] = false;
    useAbility();
  }
  if (G.keys['Digit1']) { p.weapon = 'pistol'; G.keys['Digit1'] = false; }
  if (G.keys['Digit2']) { p.weapon = 'smg'; G.keys['Digit2'] = false; }
  if (G.keys['Digit3']) { p.weapon = 'rifle'; G.keys['Digit3'] = false; }
}

export function switchLead() {
  G.lead = G.lead === 'dante' ? 'lena' : 'dante';
  const lead = G.leads[G.lead];
  const p = G.player;
  p.mesh.traverse((m) => {
    if (m.isMesh && m.geometry.type === 'CylinderGeometry' && m.position.y === 1.05) {
      m.material = new THREE.MeshLambertMaterial({ color: lead.color });
    }
  });
  if (G.notify) G.notify('Now playing as ' + lead.name + ' — ' + lead.perk + ' ready (Q).', 'info');
}

export function useAbility() {
  const p = G.player;
  if (G.lead === 'dante') {
    if (G.deadEye > 0) return;
    G.deadEye = 3.5;
    if (G.notify) G.notify('DEAD EYE — time slows, every shot counts.', 'ability');
    if (window.__pv) window.__pv.ability();
  } else {
    if (!p.inCar || G.nitro > 0) return;
    G.nitro = 4;
    if (G.notify) G.notify('NITRO — Lena floors it!', 'ability');
    if (window.__pv) window.__pv.ability();
  }
}
