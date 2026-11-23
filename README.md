# Porto Verde — an open-world crime game

[![make.fun](https://img.shields.io/badge/make.fun-bounty-gta6--01-ff5a5a)](https://make.fun/bounty/gta6-01)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Porto Verde** is a complete 3D open-world crime game that runs offline in a
desktop browser from its own static files. It was built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666, top 100
paid) and is entirely original: its own city, characters, vehicles, names,
story, art, sound and music — nothing from any commercial game.

## The city

Porto Verde is a sun-soaked coastal port city on the island of Isla Verde:
six districts (Old Port, Downtown, Barrio Sol, University Hill, Industrial
Docks, Marina Bay), a beach and ocean, a pier, a lighthouse, the Sol Casino,
Verde Stadium, City Hall, and the volcano Mount Verde on the horizon. A full
day/night cycle, rain and fog roll over it while you play.

## Two leads

- **Dante Reyes** — ex-wheelman turned fixer. Crew ability **Dead Eye** (Q)
  slows time when the shooting starts.
- **Lena Vega** — street-race queen of the beachfront. Crew ability **Nitro**
  (Q) turns any car into a rocket.

Press **C** on foot to switch leads. Each district tracks your **standing** —
work a district and it opens up to you.

## What is in the game

- **A city on foot and by car** — third-person walking and arcade driving,
  with a chase camera and mouse-look.
- **Traffic and pedestrians** — cars that drive the road grid and stop for
  you, civilians who walk the sidewalks and flee gunfire.
- **Steal any car** — press E by a parked or driven car. The owner runs, the
  law notices.
- **Wanted 1–5 stars** — PD cruisers chase and PIT you, roadblocks seal
  streets at 3 stars, a helicopter with a spotlight hunts you at 4+. Break
  line of sight to cool off, or repaint at the Pay 'n Spray garage ($150).
- **10 story missions, $12,400 purse** — a dock job, a car theft, a gang war,
  a midnight run, a stadium heist, a street-race championship, a casino hit,
  and the final showdown with the Soles' boss, Rico Vane.
- **Combat** — pistol, SMG and rifle (1/2/3), punching (F), enemy gang
  members who shoot back.
- **Side work** — 3 street races (R), taxi fares (T), 20 hidden packages
  ($250 each).
- **HUD with a live minimap** — cash, wanted stars, health/armor, clock,
  district + standing, objective text, speed, weapon, radio station.
- **Title screen, pause menu and save** — progress (cash, missions, standing,
  collectibles) persists in localStorage.
- **Sound and music** — fully synthesized WebAudio: engine hum, two-tone
  sirens, gunshots, crashes, cash jingles, mission stingers, and three
  procedural radio stations (N to change).

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| SHIFT | Run |
| Mouse + click | Aim / shoot |
| E | Enter or steal a car |
| F | Punch |
| SPACE | Handbrake |
| Q | Crew ability (Dead Eye / Nitro) |
| C | Switch lead |
| 1 / 2 / 3 | Pistol / SMG / Rifle |
| M | Next story mission |
| T | Taxi fare |
| R | Street race |
| N | Radio station |
| V | Camera distance |
| P / ESC | Pause |
| H | Help |

## Play it

Serve `game/` with any static HTTP server and open `game/index.html`, for
example:

```sh
cd game && python3 -m http.server 8080
```

No network request is made at runtime: three.js is vendored under
`game/vendor/`, all art is procedural, all sound is synthesized.

## Structure

```
main.ts                  entry program: copies game/ + screenshots/ to /output
                         and writes /output/dossier.json
vendor/makefun-game.ts   the kit's dossier library, unchanged
game/index.html          page, HUD, title/pause/dead screens
game/vendor/three.min.js three.js 0.186.1 (MIT), vendored
game/src/main.js         boot, game loop, camera, input, title flow
game/src/state.js        shared world state + helpers
game/src/city.js         Porto Verde: districts, roads, landmarks, sky, weather
game/src/vehicles.js     car factory, driving physics, traffic AI, car theft
game/src/people.js       the two leads on foot, pedestrians, combat
game/src/police.js       wanted 1–5, cruisers, PIT, roadblocks, helicopter
game/src/missions.js     10 story missions + races, taxi, collectibles
game/src/hud.js          HUD + live minimap
game/src/audio.js        synthesized WebAudio sound + radio
game/src/save.js         localStorage save/load
game/src/shots.js        screenshot staging (?shot=cover|street|mission|night)
screenshots/             4 real renders of the game
```

## License

MIT — see [LICENSE](LICENSE). three.js is MIT-licensed (see
`game/vendor/THREE-LICENSE.txt`).
