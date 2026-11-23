// shots.js — screenshot staging for the maker: URL params put the game into a
// dense, readable scene before the first frame, so every screenshot is a real
// render of the game's own code. ?shot=cover|street|mission|title|night
import { G, clamp } from './state.js';
import { spawnCar, stealCar, raiseWanted } from './vehicles.js';
import { spawnEnemy } from './people.js';
import { spawnCopCar } from './police.js';
import { startMission } from './missions.js';

export function applyShotMode() {
  const q = new URLSearchParams(location.search);
  G.shot = q.get('shot');
  G.autostart = q.has('autostart') || !!G.shot;
  if (q.has('t')) G.dayTime = parseFloat(q.get('t')) * 3600;
  if (!G.shot) return;
  G.mode = 'play';
  const p = G.player;

  if (G.shot === 'cover') {
    // Dusk chase through Downtown: player driving, 3 stars, cruisers closing in
    // from behind, mission 1 active with a visible objective.
    G.dayTime = 17.6 * 3600;
    p.x = 0; p.z = 40;
    const car = spawnCar(0, 40, 0, { name: 'Fuego Sport', color: 0xff2020, maxSpeed: 42, isPlayer: true, driver: 'player' });
    p.inCar = true; p.car = car; p.mesh.visible = false;
    car.speed = 30;
    startMission(1);
    G.wantedHeat = 3.2; G.wanted = 3;
    // two cruisers trail behind, two pace alongside — the chase stays in frame
    const trail = [
      { dx: -6, dz: -34, h: 0 }, { dx: 7, dz: -40, h: 0 },
      { dx: -16, dz: 6, h: 0 }, { dx: 16, dz: -2, h: 0 },
    ];
    for (const t of trail) {
      const c = spawnCopCar(p.x + t.dx, p.z + t.dz);
      c.car.speed = 30;
      c.car.heading = t.h;
    }
  } else if (G.shot === 'street') {
    // Midday on foot in Barrio Sol: traffic, pedestrians, shops and palms.
    G.dayTime = 13 * 3600;
    p.x = 320; p.z = 0;
    p.mesh.position.set(p.x, 0, p.z);
    const car = spawnCar(326, -6, Math.PI / 2, { name: 'Viento GT', color: 0x3b6fc2, maxSpeed: 34 });
    car.parked = true;
    G.objective = 'Press M for the next mission · T taxi · R race · H help';
  } else if (G.shot === 'mission') {
    // Mission 6 shootout at Verde Stadium: player on foot with rifle, enemies ahead,
    // objective text and wanted stars visible.
    G.dayTime = 16.5 * 3600;
    p.x = -330; p.z = 290;
    p.mesh.position.set(p.x, 0, p.z);
    p.weapon = 'rifle';
    // face the stadium so the enemies and the bowl are in frame
    G.cameraYaw = -Math.PI / 4;
    startMission(6);
    // fast-forward mission 6 to the kill stage, with its counter intact
    G.mission.stageIdx = 1;
    G.mission.killsLeft = 6;
    G.mission.enemiesSpawned = true;
    G.objective = 'Fight through stadium security (6)';
    G.wantedHeat = 2.1; G.wanted = 2;
    for (let i = 0; i < 6; i++) spawnEnemy(-348 + (i - 3) * 6, 306 + (i % 2) * 8, { missionId: 6 });
    spawnCopCar(-300, 340);
  } else if (G.shot === 'night') {
    // Night beachfront drive, 2 stars, helicopter spotlight over the ocean road.
    G.dayTime = 22.2 * 3600;
    p.x = 0; p.z = 480;
    const car = spawnCar(0, 480, Math.PI / 2, { name: 'Brisa Coupe', color: 0x2e8e8e, maxSpeed: 40, isPlayer: true, driver: 'player' });
    p.inCar = true; p.car = car; p.mesh.visible = false;
    car.speed = 30;
    G.wantedHeat = 2.2; G.wanted = 2;
    const nc1 = spawnCopCar(-70, 470);
    nc1.car.speed = 28; nc1.car.heading = Math.PI / 2;
    const nc2 = spawnCopCar(80, 486);
    nc2.car.speed = 28; nc2.car.heading = Math.PI / 2;
  } else if (G.shot === 'title') {
    G.mode = 'title';
  }
  // keep the staged player inside the city for the camera
  p.x = clamp(p.x, -560, 560); p.z = clamp(p.z, -560, 560);
}
