# SOLMARINA — Open World

[![make.fun](https://make.fun/c/gta6-01/badge.svg)](https://make.fun/c/gta6-01)
[![bounty](https://make.fun/c/gta6-01/bounty.svg)](https://make.fun/c/gta6-01)
[![play](https://make.fun/c/gta6-01/play.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6, built for
[make.fun's gta6-01 bounty](https://make.fun/c/gta6-01). A sun-soaked coastal
city of its own — original streets, characters, vehicles, story, art and
sound, nothing from any commercial game.

## The city

Solmarina is a 2560×1920 coastal city: downtown towers, Coral Park, the
marina docks, the beach and the Solmarina Grand casino. Explore it on foot or
steal any car off the street and drive.

## Systems

- **Driving** — arcade car physics, traffic that follows the road grid,
  pedestrians on the sidewalks.
- **Wanted level** — 0 to 5 stars. Steal a car, hit a pedestrian or shoot and
  the Solmarina PD responds: pursuit cars that ram, foot officers that shoot,
  and a heat level that only cools when you break line of sight. Drive
  through Pay N Spray to clear it for $100.
- **Missions** — six jobs for Mara Voss, from stealing your first wheels to
  the Solmarina Job at the Meridian Tower, each with a timer and a payout.
- **Combat** — fists and a pistol with mouse aim, reloads, car wrecks.
- **HUD** — wanted stars, health, cash, clock, speed, mission objective and
  a live minimap.
- **Save** — progress (cash, jobs done, position) persists in localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| E | Enter / steal car, exit car |
| F | Punch |
| Click | Shoot (pistol) |
| 1 / 2 | Fists / pistol |
| M | Start next mission |
| P / Esc | Pause |
| N | Mute |

## Play

```sh
node serve.ts
# open http://localhost:8080
```

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
