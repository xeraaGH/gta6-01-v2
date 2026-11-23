// police.js — the Porto Verde PD: wanted levels 1–5, patrol cruisers that chase and
// PIT the player, roadblocks at 3+ stars, a police helicopter with a spotlight at 4+,
// and wanted decay when the player breaks line of sight.
import { G, rand, randi, choice, clamp, angDiff, dist2 } from './state.js';
import { spawnCar, raiseWanted } from './vehicles.js';
import { hurtPlayer } from './people.js';

function makeCopCarMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x101418 }));
  cabin.position.set(0, 1.05, -0.2); g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
  stripe.position.y = 0.62; g.add(stripe);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  const barMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.5), barMat);
  bar.position.set(0, 1.42, -0.2); g.add(bar);
  g.userData.wheels = wheels;
  g.userData.lightBar = bar;
  return g;
}

export function spawnCopCar(x, z) {
  const mesh = makeCopCarMesh();
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const car = {
    mesh, kind: 'cruiser', color: 0x1a1a22, name: 'PD Cruiser',
    x, z, heading: rand(0, Math.PI * 2), speed: 0,
    maxSpeed: 40, accel: 20, isCop: true, driver: 'cop', health: 100,
  };
  G.cars.push(car);
  const cop = { car, ped: null, state: 'chase', pitTimer: 0, ramCd: 0, stuckTimer: 0, lastX: x, lastZ: z };
  G.cops.push(cop);
  return cop;
}

function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5),
    new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
  body.castShadow = true; g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.5),
    new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
  tail.position.set(0, 0.3, -4.2); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1; g.add(rotor);
  const spot = new THREE.SpotLight(0xfff2b0, 0, 120, 0.35, 0.5);
  spot.position.set(0, -0.5, 1); g.add(spot); g.add(spot.target);
  spot.target.position.set(0, -40, 0);
  g.userData.rotor = rotor; g.userData.spot = spot;
  return g;
}

export function updatePolice(dt) {
  const p = G.player;
  if (!p || p.dead || G.mode !== 'play') return;

  // --- wanted decay: heat falls when no cop can see the player ---
  const anyCopNear = G.cops.some((c) => c.car && dist2(c.car.x, c.car.z, p.x, p.z) < 55);
  if (G.wanted > 0 && !anyCopNear) {
    G.wantedHeat = Math.max(0, G.wantedHeat - dt * 0.06);
    const w = G.wantedHeat > 0 ? Math.ceil(G.wantedHeat - 0.001) : 0;
    if (w < G.wanted) {
      G.wanted = w;
      if (G.notify && w === 0) G.notify('You lost them — the heat is off. For now.', 'info');
    }
  }
  if (G.wanted === 0) {
    // cops give up and drive off
    for (const c of [...G.cops]) removeCop(c);
    clearRoadblocks();
    if (G.heli) { G.scene.remove(G.heli.mesh); G.heli = null; }
    return;
  }

  // --- spawn cruisers to match the wanted level ---
  const wantCops = Math.min(G.wanted + 1, 6);
  if (G.cops.length < wantCops && Math.random() < dt * 1.2) {
    const a = rand(0, Math.PI * 2);
    const d = rand(70, 110);
    spawnCopCar(clamp(p.x + Math.sin(a) * d, -560, 560), clamp(p.z + Math.cos(a) * d, -560, 560));
    if (window.__pv) window.__pv.siren(true);
  }

  // --- roadblocks at 3+ stars ---
  if (G.wanted >= 3 && G.roadblocks.length === 0 && Math.random() < dt * 0.25) {
    placeRoadblock(p);
  }

  // --- helicopter at 4+ stars ---
  if (G.wanted >= 4 && !G.heli) {
    const mesh = makeHeli();
    mesh.position.set(p.x + 30, 55, p.z - 20);
    G.scene.add(mesh);
    G.heli = { mesh, x: p.x + 30, z: p.z - 20, shootCd: 2 };
    if (G.notify) G.notify('PD helicopter overhead — the spotlight never blinks.', 'wanted');
  }
  if (G.heli) updateHeli(dt);

  // --- cruiser AI: chase, ram, PIT ---
  for (const cop of [...G.cops]) {
    const car = cop.car;
    if (!car) { removeCop(cop); continue; }
    cop.ramCd -= dt; cop.pitTimer -= dt;
    const d = dist2(car.x, car.z, p.x, p.z);
    const targetHeading = Math.atan2(p.x - car.x, p.z - car.z);
    // PIT: when alongside the player's car, swing into its rear quarter
    let aim = targetHeading;
    if (p.inCar && d < 9 && cop.pitTimer <= 0) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const px = p.x + Math.sin(p.heading + side * Math.PI / 2) * 4 - Math.sin(p.heading) * 3;
      const pz = p.z + Math.cos(p.heading + side * Math.PI / 2) * 4 - Math.cos(p.heading) * 3;
      aim = Math.atan2(px - car.x, pz - car.z);
      cop.pitTimer = 3;
    }
    const dh = angDiff(car.heading, aim);
    car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    const topSpeed = p.inCar ? Math.min(44, (p.car?.speed || 0) + 10) : 26;
    car.speed += clamp(topSpeed - car.speed, -18 * dt, car.accel * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = clamp(car.x, -580, 580); car.z = clamp(car.z, -580, 575);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const wheels = car.mesh.userData.wheels;
    for (const w of wheels) w.rotation.x += car.speed * dt * 2.4;
    // flashing light bar
    car.mesh.userData.lightBar.material.color.setHex(Math.floor(G.time * 6) % 2 === 0 ? 0xff2020 : 0x2040ff);
    // ram the player
    if (d < 4.2 && cop.ramCd <= 0) {
      cop.ramCd = 1.2;
      if (p.inCar && p.car) {
        p.car.speed *= 0.45;
        p.car.heading += rand(-0.5, 0.5);
        p.car.health -= 8;
        if (window.__pv) window.__pv.crash();
      } else {
        hurtPlayer(14);
        if (window.__pv) window.__pv.crash();
      }
    }
    // busted: cop on foot touches the player while wanted is low and player is slow
    if (!p.inCar && d < 2.2 && G.wanted <= 2 && Math.abs(p.speed || 0) < 2) {
      G.mode = 'dead';
      p.dead = true;
      if (G.notify) G.notify('BUSTED — the PD hauled you in. Bail: $300.', 'dead');
      G.cash = Math.max(0, G.cash - 300);
      if (window.__pv) window.__pv.wasted();
    }
    // stuck detection: teleport the cruiser closer
    if (dist2(car.x, car.z, cop.lastX, cop.lastZ) < 0.5 && car.speed > 5) cop.stuckTimer += dt;
    else cop.stuckTimer = 0;
    cop.lastX = car.x; cop.lastZ = car.z;
    if (cop.stuckTimer > 4) {
      const a = rand(0, Math.PI * 2);
      car.x = clamp(p.x + Math.sin(a) * 60, -560, 560);
      car.z = clamp(p.z + Math.cos(a) * 60, -560, 560);
      cop.stuckTimer = 0;
    }
    // despawn far-away cruisers
    if (d > 320) removeCop(cop);
  }
}

function updateHeli(dt) {
  const h = G.heli, p = G.player;
  const wantX = p.x + 18, wantZ = p.z - 14;
  h.x += clamp(wantX - h.x, -30 * dt, 30 * dt);
  h.z += clamp(wantZ - h.z, -30 * dt, 30 * dt);
  h.mesh.position.set(h.x, 52 + Math.sin(G.time * 1.3) * 2, h.z);
  h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
  h.mesh.userData.rotor.rotation.y += dt * 22;
  h.mesh.userData.spot.intensity = 900;
  h.shootCd -= dt;
  if (h.shootCd <= 0) {
    h.shootCd = rand(1.6, 2.6);
    if (Math.random() < 0.5) {
      hurtPlayer(7);
      if (window.__pv) window.__pv.gunshot(true);
    }
  }
}

function placeRoadblock(p) {
  // two cruisers + barriers across the road ahead of the player
  const ahead = p.inCar ? p.heading : rand(0, Math.PI * 2);
  const bx = clamp(p.x + Math.sin(ahead) * 55, -520, 520);
  const bz = clamp(p.z + Math.cos(ahead) * 55, -520, 520);
  for (const off of [-5, 5]) {
    const c = spawnCopCar(bx + Math.cos(ahead) * off, bz - Math.sin(ahead) * off);
    c.car.heading = ahead + Math.PI / 2;
    c.state = 'block';
  }
  const barrier = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xe8622a }));
    b.position.set(i * 1.8, 0.55, 0); barrier.add(b);
  }
  barrier.position.set(bx, 0, bz);
  barrier.rotation.y = ahead + Math.PI / 2;
  G.scene.add(barrier);
  G.roadblocks.push({ mesh: barrier, x: bx, z: bz, life: 45 });
  if (G.notify) G.notify('ROADBLOCK ahead — the PD sealed the street!', 'wanted');
}

export function clearRoadblocks() {
  for (const r of G.roadblocks) G.scene.remove(r.mesh);
  G.roadblocks.length = 0;
}

export function removeCop(cop) {
  if (cop.car) {
    G.scene.remove(cop.car.mesh);
    const i = G.cars.indexOf(cop.car);
    if (i >= 0) G.cars.splice(i, 1);
    cop.car = null;
  }
  const j = G.cops.indexOf(cop);
  if (j >= 0) G.cops.splice(j, 1);
}

// Pay 'n Spray: drive into the garage marker to clear wanted for $150.
export function updatePaySpray(dt) {
  const p = G.player;
  if (!p || !p.inCar || G.wanted === 0) return;
  const d = dist2(p.x, p.z, -300, 120);
  if (d < 8 && G.cash >= 150) {
    G.cash -= 150;
    G.wanted = 0; G.wantedHeat = 0;
    for (const c of [...G.cops]) removeCop(c);
    clearRoadblocks();
    if (G.heli) { G.scene.remove(G.heli.mesh); G.heli = null; }
    if (G.notify) G.notify('Fresh paint, clean plates — the heat is gone. -$150', 'info');
    if (window.__pv) window.__pv.cash();
  }
}
