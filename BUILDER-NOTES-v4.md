# BUILDER-NOTES-v4 — DUSTLINE (threejs-fps-02 v4)

## What this is

**DUSTLINE — tactical 5v5 payload escort on a desert canyon rail yard.**
One cart, 64.5 m of rail, three checkpoints. EMBER attacks in half 1,
ALLOY attacks in half 2; the team that pushes the cart further takes the
match (tie: faster, then more kills). No bomb, no capture points — the
objective moves, and the fight moves with it.

- **Track:** 64.51 m, nodes [-27,12] → [-14,8] → [0,-4] → [14,6] → [27,-2].
  Checkpoints A GATE 13.6 m, B BRIDGE 32.0 m, C VAULT 49.2 m. Each pays
  +30 s and +$500. Cart speed 1.4 m/s + 0.35 per extra pusher, cap 2.1.
  Push radius = contest radius 4.5 m. **No rollback** — distance kept is
  distance earned. A defender inside the ring freezes the cart.
- **Map:** 64×44 m desert canyon yard, noon sun. Mesas around the walls,
  a rail bridge over checkpoint B (deck y 2.7–3.0, stairs on both ends
  outside the deck footprint), containers and crates, two long lanes.
  53 colliders. The bridge is the map's vertical play: the deck overlooks
  checkpoint B and the mid-track, the stairs are the only way up.
- **Systems (reused from v3's config, same balance):** 5 weapons
  (P9 / Rasp SMG / Longshot / Maul / Lance), 3 grenades (frag / flash
  2.6 s blind / smoke 14 s), buy menu with economy (start $800, kill $300,
  half win $3250, loss bonus $1900–$3400, checkpoint $500), crouch,
  headshots (2–4×), recoil, tracers, wall penetration (longshot through
  thin walls only), falloff, respawn 4 s, round timer 150 s + 12 s buy.
- **Bots:** 5 roles (pusher / roamer / flanker / support / awper), waypoint
  graph 24 nodes, bridge routes via the stair bases, cart-pushing
  behaviour (pushers ride the ring), grenade use, buy phase (utility
  before armour — armour first starved round-1 grenades), stuck sidestep.

## What is different from v1 / v2 / v3

| | v1 FOUNDRY-9 | v2 SLAGLINE | v3 NIGHTSHIFT | **v4 DUSTLINE** |
|---|---|---|---|---|
| Mode | bomb defusal | bomb defusal | control-point ×3 | **payload escort** |
| Map | foundry, night-ish | gantry yard + smoke | container port, night | **desert canyon, noon** |
| Objective | plant / defuse | plant / defuse | hold points | **push a moving cart** |
| New verbs | — | smoke cover | crouch | **push / contest / checkpoint bonus** |
| Score (server) | 0.7556 | 0.7507 | 0.7803 | — (not submitted) |

v4 is the first entry whose objective moves. The judge's criteria reward
a readable objective and team play; a cart with a progress bar, a glowing
beacon, checkpoint rings and a contested indicator is the most legible
objective of the four. The noon desert palette is also the first daylight
map — v1–v3 are all dark/industrial, and the screenshots read better.

## Files

- `game/` — index.html + src/ (config, map, payload, rounds, combat,
  bots, hud, utility, viewmodel, textures, palette, rng, main) +
  vendor/three/ (byte-identical kit files, untouched).
- `main.ts` — dossier builder (Node 22, stdlib only); `serve.ts` — local
  server; `shots.json` — the four screenshot modes; `screenshots/` —
  start.jpg / play.jpg / buy.jpg / end.jpg.
- `sim-v4.mjs` lives in the parent directory (not shipped): headless
  match simulation against the same game modules.

## Validation — headless sim (node sim-v4.mjs)

**ALL 23 CHECKS PASS** (exit 0, seed 7):

- Static: 53 colliders (>40); track 64.51 m; waypoint graph connected
  24/24; bridge route `gS>bridgeS>deckS>deckMid`; falloff near=1, far 0.933;
  longshot penetrates a thin wall, rasp does not, longshot stops at a
  thick wall.
- Bridge climb: bot reaches deck maxY 3.06, route done.
- Delivery check: 3 pushers drive the cart to the vault, `delivered`
  fires, 3/3 checkpoints passed.
- Full match (358.0 s, 21,481 steps): phase=end, matchOver=true, winner
  EMBER; halves EMBER 1 — 1 ALLOY (history A/E); half 1 cart max 24.5 m
  (1/3 checkpoints), half 2 cart max 11.6 m (0/3); kills 28 = deaths 28;
  shots 422; grenade throws 14; **wall violations 0; NaN 0**; economy
  moved (player $6,450). No half delivered in this seed — both halves
  ended on time, which is the normal outcome for a contested cart.

## Validation — headless Chrome (file://, SwiftShader, TESTING.md method)

**4/4 modes, 0 console errors**, screenshots read back visually:

- `start` — DUSTLINE title screen, briefing, controls, START MATCH
  button; HUD behind it at --:--.
- `play` — half 1 live from the bridge stairs: cart 20.0 m / 64.5 m
  CONTESTED, checkpoint A passed, bots riding the cart, tracers, track
  bar + minimap + round history all live.
- `buy` — buy menu: 5 weapons with prices, frag/flash/smoke, Kevlar,
  hints; timer 0:15.
- `end` — "EMBER WINS THE MATCH", 64.5 m in 98.4 s vs 41.2 m, halves
  1—0, half history E A; phase MATCH OVER, timer --:--.

Screenshots are JPG, 64–91 KiB each (cap 256 KiB). Dossier text
149,240 bytes (cap 163,840). Kit check (`check --worktree`):
**PASS** competition_open, snapshot (49 files, 5,844,633 bytes),
license_osi (MIT), entrypoint (main.ts, node22). **FAIL only
transcripts_present** — no bundle yet, that is the submitter's job.
No network references in game source (grep http: only the SVG xmlns in
the favicon data-URI). No local grade exists for this competition
(server grades pairwise).

## Bugs found and fixed during this build

All found by running the sim / Chrome, not by guessing — and almost all
came from writing the first draft of main.js from memory instead of
reading the actual v3 modules first. Lesson: **grep the target file
before editing it.**

1. `rounds.start` is not a function — rounds.js exposes `startMatch()`.
   Renamed to `start`.
2. `rounds.step` called with the wrong context shape — `step()` reads
   `ctx.payload`, `ctx.emberAlive`, `ctx.alloyAlive`; main passed a
   flattened payload state. Delivery and elimination never fired.
3. `hurtFighter` passed 4 args to `applyDamage(fighter, raw)` (2 args);
   `raw` got the string `'body'` → hp NaN → every hit an instant kill.
   Headshot multiplier is now applied before the call.
4. Wrong utility API names (`util.throwGrenade`, `util.step(dt, onFrag,
   onFlash)`) — real API is `util.throw(kind, from, vel, owner)` +
   `util.step(dt, fighters, time, {onFrag, onFlash, onSmoke})`.
5. Wrong combat fx names (`fx.showTracer/showMuzzle`) — real API is
   `fx.tracer(from, to, color)` / `fx.muzzleAt(point, camera)`.
6. Wrong viewmodel API — real API is `step(dt, moveSpeed, lookDx,
   lookDy, aiming)` + `setWeapon(id)` + `kick(amount)` + `muzzleWorld()`.
7. Wrong MOVE fields (`walkSpeed/sprintMul/crouchSpeed` don't exist) —
   real config: walk 4.6, sprint 6.2, crouch 2.5, jumpSpeed 5.4,
   gravity 14.
8. Digit1 weapon cycle named `sandstorm`/`shovel`, which don't exist —
   cycle is now the four buyable weapons.
9. Bridge stairs ran *under* the deck slab (climber's head hit the slab
   at step 4, maxY stuck at 1.02). Stairs moved outside the deck
   footprint, descending away from the deck on both ends.
10. Bridge waypoint `gS` sat mid-staircase; bots approached the stair
    wall sideways and the mover refused (rise > 0.38). `gS` moved to the
    south stair base [0,12]; added `stairBaseN` [0,-19.5]; edges rewired.
11. Spawns were team-bound, not side-bound — half 2 attackers spawned
    50 m from the cart and pushed 0.0 m. Spawns are now side-based
    (attack near the cart, defend mid-track) in both halves.
12. Buy order bought armour before utility — round-1 bots threw 0
    grenades. Utility first now.
13. Kills paid no money — `ECONOMY.kill` ($300) now credited.
14. Bots threw frags during buy phase (self-damage at spawn) — guarded
    by `ctx.phase !== 'buy'`.
15. Sim wall-violation check false-positived on stairs — a climber is
    only "inside" a step box when `y + 0.38 < box.max.y`.
16. Sim termination check mistook intermission (`'over'`) for match end
    — the match ends on the `match-end` event (`'end'` + matchOver).
17. Extra `},` in main.js → SyntaxError line 354 (fixed, node --check
    clean for all modules).
18. **Chrome-only, found after the sim passed:** `fireRound` returns
    `{hits, point, blocked, dir, penetrated}` — main.js used `res.end`,
    so `fx.tracer` crashed on the first shot. Fixed to `res.point`
    (guarded; `point` is null only when the ray hits nothing).
19. **Chrome-only:** local `cart` (track position) shadowed the cart
    object (mesh) in `updateHud` → `cart.group` undefined. Renamed to
    `cartPos`.
20. **Chrome-only:** `checkpoints` from createMap is an object keyed
    `{A, B, C: {ring, letter, glow}}`, not an array — `for...of` threw
    "checkpoints is not iterable". Loop now iterates `Object.keys` and
    repaints ring + letter + glow.
21. **Chrome-only:** `?shot=start` started the match and hid the title
    screen. `start` now returns before starting anything.
22. **Chrome-only:** `?shot=end` staged phase `'over'`, whose 4 s
    intermission counted down into a phantom half 2 behind the end
    panel. End staging now uses terminal phase `'end'` + matchOver +
    timeLeft 0.
23. Buy-menu text said flash "blinds 3.5 s" — config is 2.6 s. Fixed.
24. Checkpoint letters read mirrored from behind (single double-sided
    plane). Each letter is now two front-sided planes back to back —
    reads correctly from either side, no z-fighting.
25. Stale-tab trap in the harness: `shot.mjs` picks the *first* tab
    matching the URL, so old tabs with old code shadowed fresh fixes.
    Close all game tabs before each shot run.

## Branding (verified)

- README contains the three live make.fun badges for this repo:
  `https://make.fun/badge/threejs-fps-02.svg`,
  `https://make.fun/badge/threejs-fps-02/AndryXSad/threejs-fps-02-v4/rank.svg`,
  `https://make.fun/badge/threejs-fps-02/AndryXSad/threejs-fps-02-v4/reward.svg`
  (verified via curl — real SVG content, "rank: 4,488 entries · closes
  Nov 16", "pool: $1,000 USDC"), plus a link to the bounty page.
- About (verified via `gh api repos/AndryXSad/threejs-fps-02-v4`):
  homepage `https://make.fun/bounty/threejs-fps-02`, topics
  `["fps", "game", "makefun", "threejs"]`, public. Note: PATCH cannot
  set topics — they need the separate
  `PUT /repos/{owner}/{repo}/topics` endpoint.
- Proposed submit title: **"DUSTLINE — tactical 5v5 payload escort
  on a desert canyon rail yard"**.

## Honest assessment — does v4 plausibly replace v3?

**What is true:** v4 is a genuine step-change — a mode no entry from
this account has tried, on a map no entry has tried, with the most
legible objective of the four (a moving cart, a progress bar, checkpoint
rings, a contested indicator). Everything in it is verified end-to-end:
a full match plays out in the sim, all four Chrome modes render with
zero console errors, the dossier and the kit check pass. It is the best
candidate this account has for the next slot.

**What is not true:** nothing in the local evidence says v4 closes the
gap. There is no local judge. The server bar is rank 10 = **0.9436**;
v3, the best entry so far, is **0.7803** — a gap of 0.163. The last mode
change (v2 bomb defusal → v3 control-point) gained **+0.03**. If a mode
change gains a similar amount again, v4 lands around **0.81** — still
far outside the prize zone. The most likely outcome of submitting v4 is
a score in the 0.75–0.82 band: better than v1/v2, maybe a touch above
v3, not in the money.

**Recommendation:** submit v4 for the next slot *because the slot would
otherwise go unused and v4 is strictly more differentiated than
re-submitting v3* — but do not expect the prize zone. If a stronger,
sharper v5 idea appears before the 17 Nov 04:30 WIB deadline, prefer
that; otherwise v4 is the right lottery ticket to play. Do not describe
v4 to the user as "likely to reach the prize zone" — that claim has no
evidence behind it.

## Environment notes (for the next builder)

- Chrome headless needs the WebGL policy file + file:// loading (HTTP
  localhost is blocked by LNA); see TESTING.md. SwiftShader runs the
  scene at ~1.3 fps — screenshots need 8–12 s waits.
- `shot.mjs` exits 1 on any console error — that is the check, not a
  failure of the tool. Close stale game tabs before re-shooting.
- `node --check` + sim BEFORE claiming anything works; the browser
  finds the bugs the sim cannot (tracer return shape, HUD object
  shapes, staging races).
- The end panel's backdrop is the spawn yard from (-23, 16) — the raw
  spawn sits 2 m behind the cart, so an unstaged end shot is mostly
  orange cargo.
