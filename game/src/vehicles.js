// vehicles.js — car factory, arcade driving physics, traffic AI, car theft.
// Cars are built from boxes/cylinders only: body, cabin, wheels, headlights.
import { G, rand, randi, choice, clamp, angDiff, dist2 } from './state.js';
import { snapToRoad } from './city.js';

const CAR_COLORS = [0xc23b3b, 0x3b6fc2, 0xe0c040, 0x3fae6a, 0xd8d8d8, 0x222226, 0xc27a2e, 0x7a4a9e, 0x2e8e8e, 0xb03060];
const CAR_NAMES = ['Viento GT', 'Toro Sedan', 'Brisa Coupe', 'Sol Runner', 'Marlin SUV', 'Corto Van', 'Fuego Sport', 'Palma Pickup'];

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a38 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.05, -0.2); cabin.castShadow = true; g.add(cabin);
  if (kind === 'pickup') {
    cabin.position.z = -0.9;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.6), bodyMat);
    bed.position.set(0, 0.9, 1.2); g.add(bed);
  }
  if (kind === 'van') {
    cabin.scale.set(1.05, 1.5, 1.6); cabin.position.set(0, 1.1, 0.1);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    h.position.set(s, 0.62, 2.22); g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  for (const s of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    t.position.set(s, 0.62, -2.22); g.add(t);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnCar(x, z, heading, opts = {}) {
  const kind = opts.kind || choice(['sedan', 'sedan', 'coupe', 'pickup', 'van', 'suv']);
  const color = opts.color ?? choice(CAR_COLORS);
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    mesh, kind, color, name: opts.name || choice(CAR_NAMES),
    x, z, heading, speed: 0,
    maxSpeed: opts.maxSpeed || rand(26, 38),
    accel: opts.accel || 14,
    isPlayer: !!opts.isPlayer,
    isCop: !!opts.isCop,
    isTraffic: !!opts.isTraffic,
    driver: opts.driver || null, // 'player' | 'traffic' | 'cop' | null (parked)
    health: 100,
    route: null, routeTarget: null,
    steer: 0, brakeLight: false,
    parked: !opts.driver,
    siren: false,
  };
  if (car.isTraffic) {
    const s = snapToRoad(x, z);
    car.x = s.x; car.z = s.z;
    car.routeTarget = pickNextIntersection(car);
  }
  G.cars.push(car);
  return car;
}

export function pickNextIntersection(car) {
  // Traffic drives along the road grid: pick a nearby intersection, drive to it, turn.
  const gx = Math.round(car.x / 80) * 80;
  const gz = Math.round(car.z / 80) * 80;
  const opts = [];
  if (gx + 80 <= 560) opts.push({ x: gx + 80, z: gz });
  if (gx - 80 >= -560) opts.push({ x: gx - 80, z: gz });
  if (gz + 80 <= 560) opts.push({ x: gx, z: gz + 80 });
  if (gz - 80 >= -560) opts.push({ x: gx, z: gz - 80 });
  return choice(opts);
}

export function spawnTraffic(n = 22) {
  for (let i = 0; i < n; i++) {
    const x = rand(-520, 520), z = rand(-520, 520);
    const s = snapToRoad(x, z);
    spawnCar(s.x, s.z, rand(0, Math.PI * 2), { isTraffic: true, driver: 'traffic' });
  }
  // a few parked cars to steal
  for (let i = 0; i < 8; i++) {
    const x = rand(-500, 500), z = rand(-500, 500);
    const s = snapToRoad(x, z);
    const c = spawnCar(s.x + (Math.random() < 0.5 ? 6 : -6), s.z, rand(0, Math.PI * 2), { driver: null });
    c.parked = true;
  }
}

function updatePlayerCar(car, dt) {
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 0.55 : 0);
  const steerIn = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const handbrake = k['Space'] ? true : false;
  const nitro = G.nitro > 0;
  const top = car.maxSpeed * (nitro ? 1.45 : 1) * (G.lead === 'lena' ? 1.08 : 1);
  if (fwd > 0) car.speed += car.accel * fwd * dt * (nitro ? 1.6 : 1);
  else if (fwd < 0) car.speed += car.accel * fwd * dt * 1.4;
  else car.speed -= Math.sign(car.speed) * 6 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
  car.speed = clamp(car.speed, -12, top);
  if (Math.abs(car.speed) < 0.15 && fwd === 0) car.speed = 0;
  const steerRate = clamp(Math.abs(car.speed) / 10, 0.25, 1) * (handbrake ? 1.5 : 1);
  car.heading += steerIn * steerRate * 1.9 * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // stay inside the island; beach is drivable, ocean is not
  car.x = clamp(car.x, -580, 580);
  car.z = clamp(car.z, -580, 575);
  // building collision: push out of building footprints
  for (const b of G.city.buildings) {
    if (Math.abs(car.x - b.x) < b.w / 2 + 1.6 && Math.abs(car.z - b.z) < b.d / 2 + 1.6) {
      const dx = car.x - b.x, dz = car.z - b.z;
      const px = b.w / 2 + 1.6 - Math.abs(dx), pz = b.d / 2 + 1.6 - Math.abs(dz);
      if (px < pz) car.x = b.x + Math.sign(dx || 1) * (b.w / 2 + 1.6);
      else car.z = b.z + Math.sign(dz || 1) * (b.d / 2 + 1.6);
      car.speed *= 0.55;
      if (Math.abs(car.speed) > 14) damageCar(car, 6);
    }
  }
  // traffic bump
  for (const o of G.cars) {
    if (o === car || o.driver === 'traffic' && o.speed === 0 && o.parked) continue;
    if (dist2(car.x, car.z, o.x, o.z) < 3.4) {
      const push = 3.4 - dist2(car.x, car.z, o.x, o.z);
      const a = Math.atan2(car.x - o.x, car.z - o.z);
      car.x += Math.sin(a) * push; car.z += Math.cos(a) * push;
      if (Math.abs(car.speed) > 12) { damageCar(car, 5); damageCar(o, 8); if (o.isTraffic) raiseWanted(0.4); }
      car.speed *= 0.7;
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -steerIn * clamp(Math.abs(car.speed) / 30, 0, 1) * 0.06;
  const wheels = car.mesh.userData.wheels;
  for (const w of wheels) w.rotation.x += car.speed * dt * 2.4;
  if (wheels[0]) wheels[0].rotation.y = steerIn * 0.35;
  if (wheels[1]) wheels[1].rotation.y = steerIn * 0.35;
  if (G.player) {
    G.player.x = car.x; G.player.z = car.z; G.player.heading = car.heading;
  }
}

function updateTrafficCar(car, dt) {
  if (!car.routeTarget) car.routeTarget = pickNextIntersection(car);
  const t = car.routeTarget;
  const d = dist2(car.x, car.z, t.x, t.z);
  if (d < 4) { car.routeTarget = pickNextIntersection(car); return; }
  const want = Math.atan2(t.x - car.x, t.z - car.z);
  const dh = angDiff(car.heading, want);
  car.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
  // slow down for the player / cars ahead
  let targetSpeed = 11;
  for (const o of G.cars) {
    if (o === car) continue;
    const ahead = (o.x - car.x) * Math.sin(car.heading) + (o.z - car.z) * Math.cos(car.heading);
    const side = Math.abs((o.x - car.x) * Math.cos(car.heading) - (o.z - car.z) * Math.sin(car.heading));
    if (ahead > 0 && ahead < 12 && side < 3) { targetSpeed = 0; break; }
  }
  if (G.player && !G.player.inCar) {
    const ahead = (G.player.x - car.x) * Math.sin(car.heading) + (G.player.z - car.z) * Math.cos(car.heading);
    const side = Math.abs((G.player.x - car.x) * Math.cos(car.heading) - (G.player.z - car.z) * Math.sin(car.heading));
    if (ahead > 0 && ahead < 10 && side < 2.5) targetSpeed = 0;
  }
  car.speed += clamp(targetSpeed - car.speed, -14 * dt, 8 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const wheels = car.mesh.userData.wheels;
  for (const w of wheels) w.rotation.x += car.speed * dt * 2.4;
}

export function updateCars(dt) {
  for (const car of G.cars) {
    if (car.isPlayer && G.player && G.player.inCar) updatePlayerCar(car, dt);
    else if (car.driver === 'traffic') updateTrafficCar(car, dt);
    else if (car.driver === 'cop') { /* police.js drives cop cars */ }
    else {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }
}

export function damageCar(car, amt) {
  car.health -= amt;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.mesh.children.forEach((m) => { if (m.material) m.material = m.material.clone(); });
    car.mesh.traverse((m) => { if (m.isMesh) m.material.color?.multiplyScalar?.(0.4); });
    if (car.isPlayer) {
      G.player.inCar = false; G.player.car = null;
      G.player.x = car.x + 3; G.player.z = car.z + 3;
      if (window.__pv) window.__pv.explode(car.x, car.z);
    }
  }
}

export function nearestCar(x, z, maxD = 6) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.isPlayer) continue;
    const d = dist2(x, z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Steal a car: player gets in, wanted rises, traffic driver (if any) is pulled out.
export function stealCar(car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // driver flees on foot
    car.driver = null;
    raiseWanted(1);
    G.stats.carsStolen++;
    if (G.notify) G.notify('Car stolen! The owner ran off — the law noticed.', 'crime');
  } else if (car.parked) {
    raiseWanted(0.6);
    G.stats.carsStolen++;
    if (G.notify) G.notify('Hot-wired a parked ' + car.name + '!', 'crime');
  }
  car.isPlayer = true;
  car.driver = 'player';
  car.parked = false;
  car.maxSpeed = Math.max(car.maxSpeed, 30);
  p.inCar = true; p.car = car;
  p.mesh.visible = false;
  if (window.__pv) window.__pv.carDoor();
}

export function exitCar() {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.isPlayer = false;
  if (car.driver === 'player') car.driver = null;
  car.parked = true;
  p.inCar = false; p.car = null;
  p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
  p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
}

export function raiseWanted(amount) {
  if (G.mode !== 'play') return;
  G.wantedHeat = clamp(G.wantedHeat + amount, 0, 5);
  const w = G.wantedHeat > 0 ? Math.ceil(G.wantedHeat - 0.001) : 0;
  if (w > G.wanted) {
    G.wanted = w;
    if (G.notify && w > 0) G.notify('WANTED LEVEL ' + w + ' — the Porto Verde PD is on you!', 'wanted');
    if (window.__pv) window.__pv.siren(w > 0);
  }
}
