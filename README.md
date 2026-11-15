# DUSTLINE — tactical 5v5 payload FPS

[![threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/AndryXSad/threejs-fps-02-v4/rank.svg)](https://make.fun/bounty/threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/AndryXSad/threejs-fps-02-v4/reward.svg)](https://make.fun/bounty/threejs-fps-02)

A tactical 5v5 first-person shooter built with three.js, made for the [make.fun threejs-fps-02 bounty](https://make.fun/bounty/threejs-fps-02). Two teams, one cart, 64 metres of rail through a desert canyon yard.

## The game

**Payload escort, not bomb defusal.** EMBER attacks in half 1, ALLOY attacks in half 2. The team that pushes the cart further takes the match — distance first, time second, kills third. A cart that crosses all three checkpoints and reaches the vault wins the half outright.

- **Push the cart by standing in its ring.** Up to three attackers count, speed 1.4 + 0.35 per ally, capped at 2.1 m/s. One defender in the ring freezes it. The cart never rolls back.
- **Checkpoints pay.** Every checkpoint the cart passes adds +30 s and +$500 to the attacking team.
- **A map built around the rail.** A 64×44 m desert canyon yard at noon: mesas, sand, a rail bed running west to east, a rail bridge over checkpoint B with stairs on both ends, containers and crates for cover, and two long lanes for the sniper.
- **Five roles, five weapons.** Pusher (Sandstorm SMG), roamer (Longshot rifle), flanker (Scattergun), support (Longshot + utility), AWPer (Lance, the only one-shot-headshot gun). Bots buy for their role, save what they cannot spend, and play the economy — wins pay $3,250, losses pay a streak bonus that grows to $3,400.
- **Tactics, not just aim.** Crouch to shrink your hitbox and tighten your spread. Grenades: frag, flash (3.5 s blind), smoke (14 s of blocked sight). Bots escort the cart, hold checkpoints, flank the far lane, cross the bridge, rotate to deaths, and strafe when they see you at close range.
- **A real game loop.** Buy phase (15 s, shop with B) → live round (110 s) → half swap → match end with distances, times and the half history. Players and bots respawn 4 s after death, because a payload match is decided by presence.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim · click to fire |
| R | Reload |
| C | Crouch (smaller hitbox, tighter spread) |
| Shift | Sprint |
| Space | Jump |
| B | Buy menu (buy phase) |
| 1 | Switch weapon |
| 4 / 5 / 6 | Frag / flash / smoke |

## Run it

```sh
node serve.ts            # http://localhost:8080
```

Or `node main.ts` for the harness entrypoint (same static server, with the
four screenshot modes on `?shot=start|play|buy|end`).

## Structure

```
game/
  index.html        start screen, HUD shell, import map
  main.ts           harness entrypoint (static server)
  serve.ts          dev server
  shots.json        the four dossier screenshots
  src/
    config.js       weapons, roles, movement, track, economy
    map.js          the Dustline canyon yard + rail + bridge
    payload.js      cart state machine (push / contest / checkpoints)
    rounds.js       halves, timers, tiebreaks, match end
    combat.js       hitscan, damage, armour, tracers, muzzle, viewmodel
    bots.js         five roles, buys, routes, aim, utility, push stance
    hud.js          crosshair, track bar, minimap, buy menu, killfeed
    utility.js      frag / flash / smoke grenades
    viewmodel.js    first-person gun (bob, recoil, reload)
    main.js         the game loop
  vendor/
    three.module.min.js   three.js (vendored, as in the kit)
```

## How it was validated

- **Headless simulation** (`sim-v4.mjs`): a full 2-half match run in Node with
  the real payload/rounds/bot code — both halves complete, the cart pushes,
  checkpoints pay, kills and utility happen, bots walk the whole map, 0 wall
  violations, 0 NaN.
- **Headless Chrome**: all four modes (`start`, `play`, `buy`, `end`) render
  with 0 console errors; screenshots read back visually.
- **Dossier**: text ≤ 163,840 bytes, 3 screenshots ≤ 256 KiB each.
- **Kit check**: passes except `transcripts_present` (a submitter-side check).

## What is new versus the earlier entries

- **v1 FOUNDRY-9** — bomb defusal, foundry map. Judge 0.7556.
- **v2 SLAGLINE** — bomb defusal, gantry yard + smoke. Judge 0.7507.
- **v3 NIGHTSHIFT** — control points (A/B/C) in a night container port,
  crouch, economy. Judge 0.7803, rank #454.
- **v4 DUSTLINE** — payload escort in a desert canyon at noon. A moving
  objective instead of points to hold: the whole match is one long push,
  the bots play the cart instead of a point, and the rail bridge puts the
  high ground over the objective instead of over a yard.
