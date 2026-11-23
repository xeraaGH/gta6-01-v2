// city.js — builds Porto Verde: a sun-soaked coastal port city on Isla Verde.
// Grid of roads, six districts, beach + ocean, pier, lighthouse, stadium, casino,
// volcano on the horizon, palms, streetlights, day/night sun + moon, weather.
import { G, rand, randi, choice, mulberry32, clamp } from './state.js';

const CITY = 560;          // half-extent of the built city
const BLOCK = 80;          // road spacing
const ROAD_W = 14;

export function buildCity() {
  const scene = G.scene;
  const rng = mulberry32(20261123);
  const city = {
    roads: [], blocks: [], buildings: [], palms: [],
    districts: [
      { id: 'port', name: 'Old Port', color: '#c98f4e', x0: -560, z0: -560, x1: -160, z1: -80, h: [10, 26] },
      { id: 'downtown', name: 'Downtown', color: '#7fa8c9', x0: -160, z0: -240, x1: 160, z1: 160, h: [34, 110] },
      { id: 'barrio', name: 'Barrio Sol', color: '#e0a458', x0: 160, z0: -240, x1: 560, z1: 160, h: [8, 22] },
      { id: 'hill', name: 'University Hill', color: '#8fae7a', x0: -160, z0: -560, x1: 560, z1: -240, h: [10, 30] },
      { id: 'docks', name: 'Industrial Docks', color: '#9a938a', x0: -560, z0: -80, x1: -160, z1: 480, h: [12, 30] },
      { id: 'marina', name: 'Marina Bay', color: '#5fb3c9', x0: -160, z0: 160, x1: 560, z1: 500, h: [12, 34] },
    ],
    landmarks: [
      { name: 'Sol Casino', x: 40, z: 200, kind: 'casino' },
      { name: 'Verde Stadium', x: -360, z: 320, kind: 'stadium' },
      { name: 'Porto Lighthouse', x: -480, z: 520, kind: 'lighthouse' },
      { name: 'The Pier', x: 120, z: 540, kind: 'pier' },
      { name: 'City Hall', x: 0, z: -40, kind: 'hall' },
      { name: 'Mount Verde', x: -950, z: -950, kind: 'volcano' },
    ],
  };
  G.city = city;

  // --- ground, beach, ocean ---
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8a9a5b });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.1, 0); ground.receiveShadow = true;
  scene.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1400, 120),
    new THREE.MeshLambertMaterial({ color: 0xe6cf9a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, 520); sand.receiveShadow = true;
  scene.add(sand);
  const oceanMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8e });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 900), oceanMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.4, 1020);
  scene.add(ocean);
  // volcano on the horizon
  const volcano = new THREE.Mesh(new THREE.ConeGeometry(260, 320, 24),
    new THREE.MeshLambertMaterial({ color: 0x5a4a42 }));
  volcano.position.set(-950, 140, -950); scene.add(volcano);
  const lava = new THREE.Mesh(new THREE.ConeGeometry(60, 60, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5a1e }));
  lava.position.set(-950, 300, -950); scene.add(lava);

  // --- road texture (asphalt + dashed centre line) ---
  const rc = document.createElement('canvas'); rc.width = 128; rc.height = 128;
  const rctx = rc.getContext('2d');
  rctx.fillStyle = '#33363b'; rctx.fillRect(0, 0, 128, 128);
  rctx.fillStyle = '#f2d24b';
  for (let y = 0; y < 128; y += 32) rctx.fillRect(62, y, 4, 18);
  rctx.fillStyle = '#c8c8c8'; rctx.fillRect(0, 0, 3, 128); rctx.fillRect(125, 0, 3, 128);
  const roadTex = new THREE.CanvasTexture(rc);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });

  // roads: grid lines every BLOCK, plus the beachfront avenue
  for (let c = -CITY; c <= CITY; c += BLOCK) {
    addRoad(c, 0, ROAD_W, CITY * 2 + ROAD_W, roadTex, roadMat);
    addRoad(0, c, CITY * 2 + ROAD_W, ROAD_W, roadTex, roadMat);
    city.roads.push({ axis: 'x', at: c }, { axis: 'z', at: c });
  }
  addRoad(0, 480, CITY * 2 + ROAD_W, ROAD_W, roadTex, roadMat); // beachfront avenue
  city.roads.push({ axis: 'z', at: 480 });

  // --- building facade textures ---
  const facades = [makeFacade('#b8a88a', 6, 8), makeFacade('#8fa3b5', 8, 12), makeFacade('#d8c49a', 5, 6)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);

  // buildings per block
  for (let bx = -CITY + BLOCK / 2; bx < CITY; bx += BLOCK) {
    for (let bz = -CITY + BLOCK / 2; bz < CITY; bz += BLOCK) {
      if (bz >= 440) continue; // beach strip
      const d = districtAt(bx, bz);
      if (!d) continue;
      const n = rng() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = rand(18, 34), dep = rand(18, 34);
        const h = rand(d.h[0], d.h[1]);
        const px = bx + (n === 2 ? (i === 0 ? -14 : 14) : 0) + rand(-4, 4);
        const pz = bz + rand(-4, 4);
        const mat = new THREE.MeshLambertMaterial({
          map: choice(facades),
          color: new THREE.Color(d.color).multiplyScalar(rand(0.75, 1.1)),
        });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, dep);
        b.position.set(px, 0, pz);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        city.buildings.push({ mesh: b, x: px, z: pz, w, d: dep, h, district: d.id });
      }
    }
  }

  // --- landmarks ---
  // Sol Casino: glowing tower
  const casino = new THREE.Mesh(new THREE.BoxGeometry(60, 90, 40),
    new THREE.MeshLambertMaterial({ color: 0xd8b13a, emissive: 0x553a00 }));
  casino.position.set(40, 45, 200); casino.castShadow = true; scene.add(casino);
  const casinoSign = new THREE.Mesh(new THREE.BoxGeometry(62, 8, 42),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }));
  casinoSign.position.set(40, 92, 200); scene.add(casinoSign);
  // Verde Stadium: low cylinder bowl
  const stadium = new THREE.Mesh(new THREE.CylinderGeometry(70, 76, 18, 24),
    new THREE.MeshLambertMaterial({ color: 0x9fb4c0 }));
  stadium.position.set(-360, 9, 320); stadium.castShadow = true; scene.add(stadium);
  // Lighthouse: striped tower + light
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 46, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
  tower.position.y = 23; lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 6, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b3b }));
  band.position.y = 30; lh.add(band);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  lamp.position.y = 48; lh.add(lamp);
  lh.position.set(-480, 0, 520); scene.add(lh);
  city.lighthouseLamp = lamp;
  // The Pier: planks out into the ocean
  const pier = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 160),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  pier.position.set(120, 1, 600); scene.add(pier);
  // City Hall: white block with dome
  const hall = new THREE.Mesh(new THREE.BoxGeometry(50, 26, 36),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }));
  hall.position.set(0, 13, -40); hall.castShadow = true; scene.add(hall);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3a7d8e }));
  dome.position.set(0, 26, -40); scene.add(dome);

  // --- palms along roads and beach ---
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 9, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafGeo = new THREE.ConeGeometry(4.5, 3, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8e3f });
  for (let i = 0; i < 110; i++) {
    const along = choice(city.roads);
    const t = rand(-CITY, CITY);
    const px = along.axis === 'x' ? along.at + (rng() < 0.5 ? -10 : 10) : t;
    const pz = along.axis === 'x' ? t : along.at + (rng() < 0.5 ? -10 : 10);
    if (Math.abs(px) > CITY || Math.abs(pz) > CITY) continue;
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 4.5; palm.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat); leaves.position.y = 10; palm.add(leaves);
    palm.position.set(px, 0, pz);
    scene.add(palm);
    city.palms.push(palm);
  }

  // --- streetlights at intersections ---
  const poleGeo = new THREE.CylinderGeometry(0.25, 0.25, 8, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const bulbGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  for (let x = -CITY; x <= CITY; x += BLOCK * 2) {
    for (let z = -CITY; z <= CITY; z += BLOCK * 2) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 9, 4, z + 9); scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x + 9, 8.2, z + 9); scene.add(bulb);
    }
  }

  // --- sun, moon, sky, fog, rain ---
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 1.5;
  scene.add(sun); scene.add(sun.target);
  G.sun = sun;
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.5);
  scene.add(moon); scene.add(moon.target);
  G.moon = moon;
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 1.15);
  scene.add(hemi);
  G.hemi = hemi;
  scene.fog = new THREE.Fog(0xcfd8e6, 500, 1600);
  scene.background = new THREE.Color(0x87b5d8);

  // rain: one Points cloud, toggled by weather
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    rainPos[i * 3] = rand(-300, 300); rainPos[i * 3 + 1] = rand(0, 120); rainPos[i * 3 + 2] = rand(-300, 300);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaac4d8, size: 0.7 }));
  rain.visible = false; scene.add(rain);
  G.rain = rain;

  return city;

  function addRoad(cx, cz, w, d, tex, mat) {
    const t = tex.clone(); t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(d / 14)));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.05, cz); m.receiveShadow = true;
    scene.add(m);
  }
  function districtAt(x, z) {
    for (const d of city.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
    return null;
  }
  function makeFacade(base, cols, rows) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 128, 256);
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      x.fillStyle = (r * cols + col) % 5 === 0 ? '#ffe9a0' : '#2a3542';
      x.fillRect(8 + col * (112 / cols), 10 + r * (236 / rows), 112 / cols - 6, 236 / rows - 8);
    }
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }
}

export function districtAtPoint(x, z) {
  for (const d of G.city.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return { id: 'outskirts', name: 'Outskirts', color: '#888888' };
}

// Nearest road-grid point (for spawning / snapping cars and peds).
export function snapToRoad(x, z) {
  const gx = Math.round(x / BLOCK) * BLOCK;
  const gz = Math.round(z / BLOCK) * BLOCK;
  return Math.abs(x - gx) < Math.abs(z - gz) ? { x: gx, z } : { x, z: gz };
}

export function updateSky(dt) {
  // dayTime advances: full cycle = dayLength seconds of real time.
  G.dayTime = (G.dayTime + dt * (86400 / G.dayLength)) % 86400;
  const t = G.dayTime / 86400; // 0..1
  const sunA = (t - 0.25) * Math.PI * 2; // sunrise at 06:00
  const sunH = Math.sin(sunA);
  const sun = G.sun, moon = G.moon;
  const px = Math.cos(sunA) * 400, pz = 200;
  sun.position.set(px, Math.max(20, sunH * 500), pz);
  sun.target.position.set(0, 0, 0);
  moon.position.set(-px, Math.max(20, -sunH * 400), -pz);
  const day = clamp(sunH * 1.6 + 0.25, 0, 1);
  const dusk = clamp(1 - Math.abs(sunH) * 3, 0, 1) * (sunH > -0.15 ? 1 : 0);
  sun.intensity = 0.35 + day * 2.5;
  moon.intensity = day < 0.3 ? 0.7 : 0.05;
  const sky = new THREE.Color().setHSL(0.58, 0.55, 0.08 + day * 0.5);
  if (dusk > 0.3) sky.lerp(new THREE.Color(0xff8a4a), dusk * 0.55);
  if (G.weather === 'rain') sky.lerp(new THREE.Color(0x5a6a78), 0.5);
  if (G.weather === 'fog') sky.lerp(new THREE.Color(0xb8c0c8), 0.6);
  if (G.hemi) G.hemi.intensity = 0.25 + day * 0.9;
  G.scene.background = sky;
  G.scene.fog.color.copy(sky);
  G.scene.fog.near = G.weather === 'fog' ? 120 : 500;
  G.scene.fog.far = G.weather === 'fog' ? 500 : 1600;
  if (G.rain) {
    G.rain.visible = G.weather === 'rain';
    if (G.rain.visible) {
      const p = G.rain.geometry.attributes.position;
      const c = G.camera.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 90;
        if (y < 0) y = 120;
        p.setY(i, y);
        p.setX(i, c.x + ((p.getX(i) - c.x + 300) % 600) - 300);
        p.setZ(i, c.z + ((p.getZ(i) - c.z + 300) % 600) - 300);
      }
      p.needsUpdate = true;
    }
  }
  if (G.city && G.city.lighthouseLamp) {
    G.city.lighthouseLamp.material.color.setHex(day < 0.35 ? 0xfff2a8 : 0x8a8a7a);
  }
}
