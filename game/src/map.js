// DUSTLINE: a desert canyon rail yard at noon, 64 x 44 m, built from
// sandstone rock, rusted containers and a rail line that bends through the
// canyon from the EMBER yard in the west to the ALLOY vault in the east.
// The payload cart rides that rail through three checkpoints — A GATE, B
// BRIDGE, C VAULT — and a rail bridge crosses the track over B, so the
// middle of the map has a second floor worth fighting for. Every box is a
// collider for movement and a surface a bullet stops on. The waypoint graph
// is what the bots walk: nodes at every junction, edges between neighbours,
// bridge nodes included — but the bridge is its own loop, entered only by
// the stairs, exactly like the crane in NIGHTSHIFT.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { TRACK, OWNER_COLOR } from './config.js';
import { yardTexture, wallTexture, hazardTexture, containerTexture, craneTexture, railTexture } from './textures.js';

// [centerX, centerZ, width, depth, height, material]
const BOXES = [
  // Floor and perimeter (floor is not a wall: it is the ground the feet stand on).
  [0, 0, 66, 46, 0.4, 'yard'],
  [-32.5, 0, 1, 46, 5.5, 'surface'],
  [32.5, 0, 1, 46, 5.5, 'surface'],
  [0, -22.5, 66, 1, 5.5, 'surface'],
  [0, 22.5, 66, 1, 5.5, 'surface'],
  // Rock ridges: long low sandstone walls that break the north lane into
  // corners worth holding. (The south lane is left open on purpose: it is
  // the long sightline the Lance sniper owns.)
  [-10, -16, 10, 1.5, 2.2, 'rock'],
  [12, -16, 8, 1.5, 2.2, 'rock'],
  // Pillars that break the long sightlines down the track. None of them
  // sits on the rail line or on a waypoint lane: the cart's corridor and
  // the bots' lanes stay clear.
  [-8, -9, 1.4, 1.4, 4.4, 'rock'],
  [7, -9, 1.4, 1.4, 4.4, 'rock'],
  [-24, -4, 1.2, 1.2, 3.8, 'rock'],
  [24, -4, 1.2, 1.2, 3.8, 'rock'],
  // Container rows: the yard's own walls, ribbed steel in three sun-faded colours.
  [-16, 3, 4.5, 2.2, 2.4, 'rust'],
  [-12, 13, 4.5, 2.2, 2.4, 'tealbox'],
  [-5, -10, 4.5, 2.2, 2.4, 'olive'],
  [5, 2, 4.5, 2.2, 2.4, 'rust'],
  [12, 11, 4.5, 2.2, 2.4, 'tealbox'],
  [18, 1, 4.5, 2.2, 2.4, 'rust'],
  // Vault stack at the east end: a two-high container, the tallest cover on
  // the map, guarding the vault doors the cart is heading for.
  [29, -6, 3, 2, 4.8, 'tealbox'],
  [25, -9, 2, 2, 2.4, 'olive'],
  // Lane crates: crouch cover at the lane edges, never on the lane centreline
  // (a bot walking the centreline must not meet a crate head-on) and never
  // on the rail line.
  [-22, 8, 2, 2, 1.1, 'crate'],
  [-22, 16, 2, 2, 1.1, 'crate'],
  [22, -8, 2, 2, 1.1, 'crate'],
  [22, 6, 2, 2, 1.1, 'crate'],
  [-4, 10, 2.4, 1.4, 0.9, 'crate'],
  [8, 12, 2.4, 1.4, 0.9, 'crate'],
  [-10, -10, 2, 2, 1.1, 'crate'],
  [10, -12, 2, 2, 1.1, 'crate'],
  [-26, 6, 2, 2, 1.1, 'crate'],
  [26, -12, 2, 2, 1.1, 'crate'],
  // Low walls at the checkpoints: crouch cover while pushing the cart.
  // Each sits beside its checkpoint's approach lane, never on a waypoint
  // line and never on the stairs — a wall on a lane is a stuck bot.
  [-19, 4, 6, 1, 1.2, 'hairline'],
  [4, 0, 6, 1, 1.2, 'hairline'],
  // Bridge legs: four posts just outside the deck, so the walkway itself is
  // never blocked.
  [-1.5, -11, 0.8, 0.8, 3.0, 'bridge'],
  [1.5, -11, 0.8, 0.8, 3.0, 'bridge'],
  [-1.5, 3, 0.8, 0.8, 3.0, 'bridge'],
  [1.5, 3, 0.8, 0.8, 3.0, 'bridge'],
];

// The rail bridge deck: a raised walkway over checkpoint B, [centerX,
// centerZ, width, depth, topY]. The deck hangs at y = 3.0; the stairs below
// climb to it. The cart passes UNDER it (deck bottom 2.7 m, cart 1.2 m),
// so the bridge is high ground over the payload route, not a gate on it.
const DECKS = [
  [0, -4, 2.4, 16, 3.0],
];

// Stair steps: nine boxes of 0.34 rise each, climbing from the ground to the
// bridge deck. The stairs sit OUTSIDE the deck slab's footprint, on purpose:
// the deck hangs at y 2.7–3.0 over z -12..4, and a climber's head (feet + 1.72)
// would hit the slab at the fourth step if the stairs ran under it — the
// mover refuses a step-up with no headroom, so the climb would dead-end at
// y 1.02. Instead the top step lands flush on the deck's lip and the stairs
// descend away from it: south stairs from z = 4.5 down to z = 10.9, north
// stairs from z = -12.5 up to z = -18.9, each step 0.34 lower than the last.
// [centerX, centerZ, width, depth, topY, material]
const STAIRS = [];
for (let i = 0; i < 9; i += 1) {
  const top = 3.06 - i * 0.34;
  // South stairs at x = 0, top step at the deck's south lip (z = 4.5),
  // descending southward to the ground at z = 10.9.
  STAIRS.push([0, 4.5 + i * 0.8, 2.4, 0.9, top, 'bridge']);
  // North stairs at x = 0, top step at the deck's north lip (z = -12.5),
  // descending northward to the ground at z = -18.9.
  STAIRS.push([0, -12.5 - i * 0.8, 2.4, 0.9, top, 'bridge']);
}

export const SPAWNS = {
  // Attackers start west, beside the cart: the push begins the moment the
  // round goes live. Defenders start mid-track, around checkpoints A and B:
  // close enough to contest the cart in seconds, far enough that the
  // attackers get the first metres. The sets are by SIDE, not by team —
  // in half 2 the teams swap, and the spawns swap with them; a spawn tied
  // to a team would strand half 2's attackers 50 m from the cart.
  attack: [[-28, 16], [-25, 18], [-27, 14], [-24, 17], [-29, 13]],
  defend: [[-10, 10], [-6, 2], [-2, 12], [-12, 4], [4, 10]],
};

// Waypoint graph: id -> [x, z], edges by id. Bots walk edges; a bot escorting
// the cart walks to the track node nearest the cart, a defender holds near a
// checkpoint node, the AWPer holds the bridge or the north lane. Bridge nodes
// sit on the deck (y = 3): a bot that paths through them climbs the stairs,
// crosses over the payload route, and drops down the other side. The bridge
// is its own loop, entered only by the stairs: the ground graph never routes
// a bot through a deck node by accident — routeViaBridge builds that path
// explicitly, in bots.js.
export const WAYPOINTS = {
  spawnE: [-27, 17], spawnA: [27, -8],
  t0: [-27, 12], tA: [-14, 8], tB: [0, -4], tC: [14, 6], tEnd: [27, -2],
  nW: [-20, -14], nM: [-7, -14], nE: [7, -14], nEE: [20, -14],
  sW: [-20, 16], sM: [-7, 16], sE: [7, 16], sEE: [20, 16],
  mW: [-14, 0], mE: [10, -2], gS: [0, 12],
  bridgeS: [0, 4.5], deckS: [0, -1], deckMid: [0, -4], deckN: [0, -9], stairN: [0, -12.5], stairBaseN: [0, -19.5],
};
export const EDGES = {
  spawnE: ['t0', 'sW'],
  t0: ['spawnE', 'tA', 'sW'],
  tA: ['t0', 'sM', 'mW', 'nW'],
  tB: ['tC', 'mE', 'mW'],
  tC: ['tB', 'tEnd', 'sE', 'mE'],
  tEnd: ['tC', 'spawnA', 'sEE', 'nEE'],
  spawnA: ['tEnd', 'nEE'],
  nW: ['tA', 'sW', 'nM'],
  nM: ['nW', 'mW', 'nE', 'stairBaseN'],
  nE: ['nM', 'tB', 'nEE'],
  nEE: ['nE', 'sEE', 'tEnd', 'spawnA'],
  sW: ['spawnE', 't0', 'nW'],
  sM: ['sE', 'tA', 'mW'],
  sE: ['sM', 'sEE', 'tC', 'gS'],
  sEE: ['sE', 'tEnd', 'nEE'],
  mW: ['tA', 'sM', 'nM', 'tB'],
  mE: ['tB', 'tC', 'nE', 'sE'],
  gS: ['sE', 'bridgeS'],
  // The bridge loop: entered only from the stair bases, left only down the
  // other stairs. gS is the south stair BASE (ground, z = 12): a bot that
  // routes to bridgeS climbs the stairs from the bottom step, never into
  // their side — a solid stair box approached from the side is a wall 1–3 m
  // high, and the mover cannot step up more than 0.38 m. Same in the north:
  // stairBaseN is the ground at the bottom of the north stairs, stairN the
  // top step on the deck's north lip.
  bridgeS: ['gS', 'deckS'],
  deckS: ['bridgeS', 'deckMid'],
  deckMid: ['deckS', 'deckN'],
  deckN: ['deckMid', 'stairN'],
  stairN: ['deckN', 'stairBaseN'],
  stairBaseN: ['nM', 'nE', 'stairN'],
};

// Breadth-first route over the graph; returns an array of waypoint ids.
export function route(fromId, toId) {
  if (fromId === toId) return [toId];
  const prev = { [fromId]: null };
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of EDGES[cur] ?? []) {
      if (prev[next] !== undefined) continue;
      prev[next] = cur;
      if (next === toId) {
        const path = [toId];
        let node = cur;
        while (node) { path.unshift(node); node = prev[node]; }
        return path;
      }
      queue.push(next);
    }
  }
  return [toId];
}

export function nearestWaypoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const [id, [wx, wz]] of Object.entries(WAYPOINTS)) {
    const d = (wx - x) ** 2 + (wz - z) ** 2;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

// The track as a polyline: cumulative segment lengths, and the position (and
// heading) of the cart at a given distance along it. The checkpoints in
// config.js sit at the distances of the track nodes A, B and C.
const TRACK_SEGS = [];
{
  const nodes = TRACK.nodes;
  let acc = 0;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const [x0, z0] = nodes[i];
    const [x1, z1] = nodes[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    TRACK_SEGS.push({ x0, z0, x1, z1, len, start: acc });
    acc += len;
  }
}
export const TRACK_LENGTH = TRACK_SEGS[TRACK_SEGS.length - 1].start + TRACK_SEGS[TRACK_SEGS.length - 1].len;

export function trackPosAt(dist) {
  const d = Math.max(0, Math.min(TRACK_LENGTH, dist));
  let seg = TRACK_SEGS[TRACK_SEGS.length - 1];
  for (const s of TRACK_SEGS) {
    if (d <= s.start + s.len) { seg = s; break; }
  }
  const t = Math.min(1, Math.max(0, (d - seg.start) / seg.len));
  return {
    x: seg.x0 + (seg.x1 - seg.x0) * t,
    z: seg.z0 + (seg.z1 - seg.z0) * t,
    angle: Math.atan2(seg.x1 - seg.x0, seg.z1 - seg.z0),
  };
}

// Slab ray vs a list of AABBs: returns the distance to the first hit, or Infinity.
export function rayHitDistance(colliders, ox, oy, oz, dx, dy, dz, maxDist) {
  let best = Infinity;
  for (const b of colliders) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b, maxDist);
    if (t < best) best = t;
  }
  return best;
}

// Like rayHitDistance, but also returns the box hit, so the Longshot can ask
// how thick the wall it just hit is before it spends its penetration on it.
export function rayHitBox(colliders, ox, oy, oz, dx, dy, dz, maxDist) {
  let best = Infinity;
  let bestBox = null;
  for (const b of colliders) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b, maxDist);
    if (t < best) { best = t; bestBox = b; }
  }
  return { dist: best, box: bestBox };
}

function rayBox(ox, oy, oz, dx, dy, dz, b, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const mins = [b.min.x, b.min.y, b.min.z];
  const maxs = [b.max.x, b.max.y, b.max.z];
  const os = [ox, oy, oz];
  const ds = [dx, dy, dz];
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mins[i] || os[i] > maxs[i]) return Infinity;
    } else {
      let t1 = (mins[i] - os[i]) / ds[i];
      let t2 = (maxs[i] - os[i]) / ds[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// Shared horizontal mover: the player and the bots resolve against the same
// colliders, one axis at a time, so a wall never swallows either of them.
// `wishX/wishZ` are target velocities in m/s; the body carries vx/vz.
// Step-up: when a move is blocked by a box whose top is at most MOVE.stepUp
// above the body's feet and there is headroom above it, the body steps onto
// the box instead of stopping. That is what makes stairs, crates and the
// rail bridge climbable without a jump.
const MOVER_RADIUS = 0.34;
const _probe = new THREE.Box3();
export function stepMover(body, wishX, wishZ, dt, colliders, accel = 30, stepUp = 0.38) {
  const blend = Math.min(1, accel * dt);
  body.vx += (wishX - body.vx) * blend;
  body.vz += (wishZ - body.vz) * blend;
  if (!wishX && !wishZ) {
    const damp = Math.max(0, 1 - 9 * dt);
    body.vx *= damp;
    body.vz *= damp;
  }
  const h = body.height || 1.72;
  const nextX = body.x + body.vx * dt;
  const blockX = moverBlock(nextX, body.y, body.z, h, colliders);
  if (!blockX) body.x = nextX;
  else if (tryStepUp(body, blockX, stepUp, h, colliders)) body.x = nextX;
  else body.vx = 0;
  const nextZ = body.z + body.vz * dt;
  const blockZ = moverBlock(body.x, body.y, nextZ, h, colliders);
  if (!blockZ) body.z = nextZ;
  else if (tryStepUp(body, blockZ, stepUp, h, colliders)) body.z = nextZ;
  else body.vz = 0;
}

function moverBlock(x, y, z, height, colliders) {
  _probe.min.set(x - MOVER_RADIUS, y + 0.04, z - MOVER_RADIUS);
  _probe.max.set(x + MOVER_RADIUS, y + height - 0.04, z + MOVER_RADIUS);
  for (const c of colliders) if (_probe.intersectsBox(c)) return c;
  return null;
}

function tryStepUp(body, block, stepUp, height, colliders) {
  const rise = block.max.y - body.y;
  if (rise <= 0 || rise > stepUp) return false;
  // Headroom: the space above the ledge must fit the body.
  _probe.min.set(body.x - MOVER_RADIUS, block.max.y + 0.04, body.z - MOVER_RADIUS);
  _probe.max.set(body.x + MOVER_RADIUS, block.max.y + height - 0.04, body.z + MOVER_RADIUS);
  for (const c of colliders) {
    if (c !== block && _probe.intersectsBox(c)) return false;
  }
  body.y = block.max.y;
  return true;
}

export function createMap(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const yardTex = yardTexture();
  const wallTex = wallTexture();
  const hazardTex = hazardTexture();
  const craneTex = craneTexture();
  const railTex = railTexture();
  const containerTex = {
    rust: containerTexture(PALETTE.rust),
    tealbox: containerTexture(PALETTE.tealbox),
    olive: containerTexture(PALETTE.olive),
  };

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'sun' ? 0.5 : 0.92,
      metalness: name === 'steel' || name === 'bridge' || name === 'rail' ? 0.55 : 0.05,
    });
  }
  // Textured variants: the same colours, but the surface reads as sand,
  // strata and ribbed container steel instead of flat colour.
  materials.yard = new THREE.MeshStandardMaterial({ map: yardTex, roughness: 0.95, metalness: 0 });
  materials.surface = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0 });
  materials.hairline = new THREE.MeshStandardMaterial({ map: wallTex, color: new THREE.Color(PALETTE.hairline), roughness: 0.95, metalness: 0 });
  materials.rock = new THREE.MeshStandardMaterial({ map: wallTex, color: new THREE.Color(PALETTE.rock), roughness: 1, metalness: 0 });
  materials.bridge = new THREE.MeshStandardMaterial({ map: craneTex, roughness: 0.7, metalness: 0.6 });
  materials.rail = new THREE.MeshStandardMaterial({ map: railTex, roughness: 0.85, metalness: 0.3 });
  for (const key of ['rust', 'tealbox', 'olive']) {
    materials[key] = new THREE.MeshStandardMaterial({ map: containerTex[key], roughness: 0.75, metalness: 0.35 });
  }

  const colliders = [];
  const shootables = [];
  function box(cx, cz, w, d, h, material, yBase = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[material]);
    mesh.position.set(cx, yBase + h / 2 - (material === 'yard' ? 0.2 : 0), cz);
    if (material === 'yard') mesh.position.y = -0.2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const b = new THREE.Box3().setFromObject(mesh);
    if (material !== 'yard') {
      colliders.push(b);
      shootables.push(mesh);
    }
    return mesh;
  }
  for (const [cx, cz, w, d, h, material] of BOXES) box(cx, cz, w, d, h, material);
  // Deck slabs: thin boxes whose TOP is at topY, so feet stand at topY.
  for (const [cx, cz, w, d, topY] of DECKS) box(cx, cz, w, d, 0.3, 'bridge', topY - 0.3);
  // Stairs: solid boxes from the ground to their top step.
  for (const [cx, cz, w, d, top, material] of STAIRS) box(cx, cz, w, d, top, material);
  // Hazard stripes along the bridge deck edges, visual only: they mark the
  // drop, they do not block feet.
  for (const [cx, cz, w, d, topY] of DECKS) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.04, d),
      new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.8 }),
    );
    strip.position.set(cx - w / 2 + 0.14, topY + 0.02, cz);
    group.add(strip);
    const strip2 = strip.clone();
    strip2.position.set(cx + w / 2 - 0.14, topY + 0.02, cz);
    group.add(strip2);
  }
  // The rail bed: a dark gravel strip along every track segment, visual
  // only — the cart rides it, fighters walk over it. The bed is laid along
  // the segment's own direction, so the payload route reads on the ground.
  for (const seg of TRACK_SEGS) {
    const len = seg.len;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, len), materials.rail);
    bed.position.set((seg.x0 + seg.x1) / 2, 0.03, (seg.z0 + seg.z1) / 2);
    bed.rotation.y = Math.atan2(seg.x1 - seg.x0, seg.z1 - seg.z0);
    bed.receiveShadow = true;
    group.add(bed);
  }
  // Mesas beyond the walls: huge rock slabs, so the canyon has a horizon and
  // the screenshots have depth. Visual only, outside the walls, no colliders.
  const mesaMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x9a744a), roughness: 1 });
  const mesaTop = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xb08d5e), roughness: 1 });
  for (const [mx, mz, mw, mh, md] of [[-28, -30, 14, 9, 6], [-8, -32, 18, 12, 7], [14, -30, 12, 7, 6], [30, -28, 10, 10, 6], [-30, 30, 12, 8, 6], [28, 30, 14, 11, 7]]) {
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md), mesaMat);
    mesa.position.set(mx, mh / 2 - 1, mz);
    group.add(mesa);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(mw + 0.6, 0.8, md + 0.6), mesaTop);
    cap.position.set(mx, mh - 0.6, mz);
    group.add(cap);
  }
  // The sun: a pale disc high over the east, so the noon has a source in
  // the sky and the screenshots have a glare to look at.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2cf), fog: false }),
  );
  sun.position.set(38, 30, -30);
  sun.lookAt(0, 2, 0);
  group.add(sun);

  // The payload cart: an armoured hauler on the rail — a low steel base, a
  // ribbed cargo box, a mast with a glowing ember beacon. main.js moves it
  // along the track from payload.state; its light is the one strong colour
  // on the route, so the objective reads across the whole map.
  const cartGroup = new THREE.Group();
  const cartSteel = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x3a3f4a), roughness: 0.5, metalness: 0.7 });
  const cartArmor = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8a4a26), roughness: 0.7, metalness: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.4), cartSteel);
  base.position.y = 0.45;
  base.castShadow = true;
  cartGroup.add(base);
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 1.9), cartArmor);
  cargo.position.y = 1.05;
  cargo.castShadow = true;
  cartGroup.add(cargo);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), cartSteel);
  mast.position.set(0, 1.8, -0.8);
  cartGroup.add(mast);
  const beaconOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(OWNER_COLOR.ember) }),
  );
  beaconOrb.position.set(0, 2.3, -0.8);
  cartGroup.add(beaconOrb);
  const cartLight = new THREE.PointLight(new THREE.Color(OWNER_COLOR.ember), 9, 12, 1.7);
  cartLight.position.set(0, 2.2, 0);
  cartGroup.add(cartLight);
  // Wheels: four dark discs that sit on the rail bed.
  for (const [wx, wz] of [[-0.7, -0.9], [0.7, -0.9], [-0.7, 0.9], [0.7, 0.9]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), cartSteel);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.22, wz);
    cartGroup.add(wheel);
  }
  group.add(cartGroup);
  const cart = { group: cartGroup, light: cartLight, beacon: beaconOrb };

  // Checkpoint markers: a stone ring on the ground, a tall post with the
  // checkpoint's letter, and a light — all in the checkpoint's state colour
  // (neutral grey until the cart passes, ember orange after), so who has
  // taken ground reads across the whole map. main.js repaints them from
  // payload.state.
  function letterTexture(key) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key, 64, 68);
    return new THREE.CanvasTexture(c);
  }
  const checkpoints = {};
  for (const cp of TRACK.checkpoints) {
    const node = TRACK.nodes[TRACK.checkpoints.indexOf(cp) + 1];
    const [px, pz] = node;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.0, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(OWNER_COLOR.neutral), transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(px, 0.04, pz);
    group.add(ring);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), cartSteel);
    post.position.set(px + 2.2, 1.7, pz);
    post.castShadow = true;
    group.add(post);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: letterTexture(cp.key), transparent: true, color: new THREE.Color(OWNER_COLOR.neutral), side: THREE.DoubleSide, depthWrite: false }),
    );
    letter.position.set(px + 2.2, 3.9, pz);
    group.add(letter);
    const glow = new THREE.PointLight(new THREE.Color(OWNER_COLOR.neutral), 6, 10, 1.7);
    glow.position.set(px, 3.2, pz);
    scene.add(glow);
    checkpoints[cp.key] = { ring, letter, glow, x: px, z: pz, dist: cp.dist, name: cp.name };
  }

  // Light, for the noon: a bright blue hemisphere, a high warm sun with
  // shadows from the south-east, and a faint cool fill from the north so the
  // shaded side of a rock is never black.
  const sky = new THREE.HemisphereLight(new THREE.Color(0x9ec8e8), new THREE.Color(0xc8a06a), 0.85);
  scene.add(sky);
  const sunLight = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 1.7);
  sunLight.position.set(22, 30, 14);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -36;
  sunLight.shadow.camera.right = 36;
  sunLight.shadow.camera.top = 28;
  sunLight.shadow.camera.bottom = -28;
  sunLight.shadow.camera.far = 90;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight, sunLight.target);
  const fill = new THREE.DirectionalLight(new THREE.Color(0x7fb2d9), 0.4);
  fill.position.set(-10, 14, -22);
  scene.add(fill);

  return { colliders, shootables, group, cart, checkpoints };
}
