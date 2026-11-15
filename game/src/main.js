// DUSTLINE: the game itself. A 5v5 payload escort on the Dustline canyon
// rail yard — you and four bots against five. EMBER attacks in half 1,
// ALLOY attacks in half 2, and the team that pushes the cart further takes
// the match. Push the cart by standing in its ring; a defender in the ring
// freezes it. Checkpoints pay +30 s and +$500. The loop is a new game on
// the engine NIGHTSHIFT proved: the map, the objective, the bot brains and
// the movement are all new — a moving objective instead of points to hold,
// a desert canyon at noon instead of a night port, and a rail bridge over
// the payload route instead of a crane over a yard.
import * as THREE from 'three';
import { WEAPONS, GRENADES, ARMOR_PRICE, MOVE, OWNER_COLOR, ROUND, TRACK, ECONOMY } from './config.js';
import { SPAWNS, createMap, rayHitDistance, stepMover, route, nearestWaypoint, trackPosAt, TRACK_LENGTH } from './map.js';
import { createCombatFx, createWeaponState, weaponStep, weaponReady, weaponReload, fireRound, applyDamage } from './combat.js';
import { createBot, planRound, buyPhase, applyRoundEconomy, resetBotForRound, botStep, groundHeightAt } from './bots.js';
import { createUtility } from './utility.js';
import { createViewmodel } from './viewmodel.js';
import { createHud, enemyVisibleOnMinimap } from './hud.js';
import { createRounds } from './rounds.js';
import { createPayload } from './payload.js';

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
const godMode = shotMode === 'play';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fb2d9);
scene.fog = new THREE.Fog(0xd8c49a, 50, 130);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);

const { colliders, shootables, cart, checkpoints } = createMap(scene);
const fx = createCombatFx(scene);
const util = createUtility(scene, colliders);
const hud = createHud();
const viewmodel = createViewmodel(camera);
let viewmodelWeapon = null;

// Checkpoint colours, prebuilt once: the markers repaint every frame from
// the payload state, and the hot loop makes no new objects.
const ownerColors = {
  ember: new THREE.Color(OWNER_COLOR.ember),
  alloy: new THREE.Color(OWNER_COLOR.alloy),
  neutral: new THREE.Color(OWNER_COLOR.neutral),
};

let time = 0;
let lastDeath = null;
let matchStarted = false;
let roundEndAt = 0;
let playerFlashUntil = 0;
let playerFlashDuration = 1;
let lookDx = 0;
let lookDy = 0;

const player = {
  isBot: false,
  team: 'ember', // the player is always EMBER: attacks in half 1, defends in half 2
  x: 0, y: 0, z: 18.5, vx: 0, vz: 0, vy: 0,
  height: MOVE.standHeight, eye: MOVE.standEye,
  crouched: false, grounded: true,
  yaw: 0, pitch: 0,
  hp: 100, armor: 0, alive: true,
  money: 800, kills: 0, deaths: 0,
  weapon: createWeaponState('longshot'),
  grenades: { frag: 0, flash: 0, smoke: 0 },
};

const bots = [];
for (let i = 0; i < 4; i += 1) {
  const bot = createBot('ember', i, SPAWNS.attack[i], Math.random);
  scene.add(bot.mesh);
  bots.push(bot);
}
for (let i = 0; i < 5; i += 1) {
  const bot = createBot('alloy', i, SPAWNS.defend[i], Math.random);
  scene.add(bot.mesh);
  bots.push(bot);
}
const emberBots = bots.filter((b) => b.team === 'ember');
const alloyBots = bots.filter((b) => b.team === 'alloy');

const payload = createPayload({
  onEvent(type, data) {
    if (type === 'checkpoint') {
      rounds.addTime(ROUND.bonusSeconds);
      const attacking = rounds.state.attacking;
      const teamBots = attacking === 'ember' ? emberBots : alloyBots;
      for (const b of teamBots) b.money += 500;
      if (player.team === attacking) {
        player.money += 500;
        hud.setMoney(player.money);
      }
      hud.showMessage(`Checkpoint ${data.point} ${data.name} taken! +30 s, +$500.`, 3500);
    } else if (type === 'delivered') {
      hud.showMessage('Payload delivered — the vault doors are open!', 4000);
    }
  },
});

const rounds = createRounds({ onEvent: handleRoundEvent });

function handleRoundEvent(type, data) {
  if (type === 'buy-start') {
    // Reset everyone to their spawn, reset the cart, run the buy phase.
    payload.reset();
    // Spawns follow the SIDE, not the team: the attackers start beside the
    // cart, the defenders mid-track — in both halves.
    const atkSpawns = SPAWNS.attack;
    const defSpawns = SPAWNS.defend;
    const playerSpawns = data.attacking === 'ember' ? atkSpawns : defSpawns;
    player.x = playerSpawns[2][0];
    player.z = playerSpawns[2][1];
    player.y = 0;
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    player.hp = 100;
    player.alive = true;
    player.crouched = false;
    player.height = MOVE.standHeight;
    player.eye = MOVE.standEye;
    emberBots.forEach((b, i) => resetBotForRound(b, (data.attacking === 'ember' ? atkSpawns : defSpawns)[i], time));
    alloyBots.forEach((b, i) => resetBotForRound(b, (data.attacking === 'alloy' ? atkSpawns : defSpawns)[i], time));
    buyPhase(emberBots, data.attacking === 'ember', Math.random);
    buyPhase(alloyBots, data.attacking === 'alloy', Math.random);
    planRound(emberBots, alloyBots, time, Math.random, data.attacking);
    const side = data.attacking === 'ember' ? 'YOU ATTACK — push the cart!' : 'YOU DEFEND — hold the cart!';
    hud.setPhase(`HALF ${data.half} — ${data.attacking === 'ember' ? 'EMBER ATTACKS' : 'ALLOY ATTACKS'} · BUY PHASE`);
    hud.setScores(rounds.state.score.ember, rounds.state.score.alloy);
    hud.setPayload(payload.state, TRACK_LENGTH);
    hud.setRoundHistory(data.history);
    hud.setHealth(player.hp, player.armor);
    hud.setMoney(player.money);
    hud.showMessage(`Half ${data.half} — ${side} (B to buy)`);
    if (!shotMode) hud.showBuyMenu(player.money, player.weapon.id, player.grenades, player.armor > 0);
  } else if (type === 'live-start') {
    hud.hideBuyMenu();
    hud.setPhase(`HALF ${rounds.state.half} — ${rounds.state.attacking === 'ember' ? 'EMBER ATTACKS' : 'ALLOY ATTACKS'} · LIVE`);
    hud.showMessage(rounds.state.attacking === 'ember' ? 'Go! Push the cart to the vault.' : 'Go! Stop the cart before the vault.');
  } else if (type === 'round-end') {
    applyRoundEconomy(emberBots, data.winner === 'ember');
    applyRoundEconomy(alloyBots, data.winner === 'alloy');
    player.money += data.winner === 'ember' ? 3250 : data.lossBonus;
    hud.setRoundHistory(data.history);
    hud.setMoney(player.money);
    const verb = data.winner === 'ember' ? 'EMBER takes the half' : 'ALLOY takes the half';
    hud.showMessage(`${verb} — ${data.reason}. Cart: ${data.dist.toFixed(1)} m.`, 4000);
    hud.setPhase(`${verb.toUpperCase()} — ${data.reason.toUpperCase()}`);
    roundEndAt = time + 4;
  } else if (type === 'match-end') {
    const e = data.results.ember;
    const a = data.results.alloy;
    const title = data.winner === 'ember' ? 'EMBER WINS THE MATCH' : data.winner === 'alloy' ? 'ALLOY WINS THE MATCH' : 'DRAW — THE CART DECIDES NOTHING';
    hud.setPhase('MATCH OVER');
    hud.showEnd(
      title,
      [
        `EMBER pushed ${e.dist.toFixed(1)} m${e.time !== null ? ` in ${e.time.toFixed(1)} s` : ''} · ALLOY pushed ${a.dist.toFixed(1)} m${a.time !== null ? ` in ${a.time.toFixed(1)} s` : ''}`,
        `Halves: EMBER ${data.score.ember} — ${data.score.alloy} ALLOY`,
        `Your line: ${player.kills} kills, ${player.deaths} deaths`,
        `Half history: ${data.history.map((h) => (h === 'E' ? 'E' : 'A')).join(' ')}`,
      ],
    );
  }
}

function teamOf(fighter) { return fighter.team; }

function killFighter(fighter, killer, part, weaponDef, weaponName) {
  if (!fighter.alive) return;
  fighter.alive = false;
  fighter.deaths += 1;
  fighter.respawnAt = time + 4;
  if (fighter.isBot) fighter.mesh.visible = false;
  if (killer) {
    killer.kills += 1;
    killer.money = (killer.money ?? 0) + ECONOMY.kill;
  }
  lastDeath = { x: fighter.x, z: fighter.z, time };
  const victim = fighter.isBot ? `BOT ${fighter.team === 'ember' ? 'EMBER' : 'ALLOY'}#${fighter.index + 1} (${fighter.role})` : 'YOU';
  const by = killer ? (killer.isBot ? `BOT ${killer.team === 'ember' ? 'EMBER' : 'ALLOY'}#${killer.index + 1}` : 'YOU') : 'the world';
  hud.addKill(`${by} → ${victim} [${weaponName}]`, killer && !killer.isBot ? '#ffb347' : '#ffffff');
}

function hurtFighter(fighter, killer, part, dmg, weaponDef, weaponName) {
  if (!fighter.alive) return;
  // Headshots multiply by the weapon's headMult; applyDamage takes the
  // final number (fighter, raw) — passing the part string as the damage
  // would silently NaN the health and kill on every hit.
  const total = dmg * (part === 'head' ? (weaponDef.headMult ?? 2) : 1);
  applyDamage(fighter, total);
  const died = !fighter.alive;
  if (fighter === player) {
    hud.damageFlash();
    if (killer) {
      const dx = killer.x - player.x;
      const dz = killer.z - player.z;
      const angleTo = Math.atan2(dx, dz);
      const rel = angleTo - player.yaw;
      hud.hitDirection(rel, time);
    }
  }
  if (died) killFighter(fighter, killer, part, weaponDef, weaponName);
}

function fireWeapon(fighter) {
  if (!fighter.alive) return;
  if (!weaponReady(fighter.weapon)) return;
  const eye = fighter.y + fighter.eye;
  const origin = { x: fighter.x, y: eye, z: fighter.z };
  const spread = (fighter.isBot ? 0 : fighter.weapon.bloom) + (fighter.crouched ? -0.004 : 0);
  const dir = {
    x: -Math.sin(fighter.yaw) * Math.cos(fighter.pitch) + (Math.random() - 0.5) * spread,
    y: Math.sin(fighter.pitch) + (Math.random() - 0.5) * spread,
    z: -Math.cos(fighter.yaw) * Math.cos(fighter.pitch) + (Math.random() - 0.5) * spread,
  };
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  dir.x /= len;
  dir.y /= len;
  dir.z /= len;
  const targets = bots.filter((b) => b.team !== fighter.team && b.alive);
  if (fighter.team !== player.team && player.alive) targets.push(player);
  const res = fireRound(fighter.weapon, origin, dir, fighter.weapon.bloom, Math.random, colliders, targets, fighter.weapon.def.range);
  if (!res) return;
  if (fighter === player) {
    if (res.point) fx.tracer(origin, res.point, fighter.weapon.def.tracer);
    fx.muzzleAt(viewmodel.muzzleWorld(), camera);
    viewmodel.kick(fighter.weapon.def.recoil);
  } else if (res.point) {
    fx.tracer(origin, res.point, fighter.weapon.def.tracer);
  }
  for (const hit of res.hits) hurtFighter(hit.fighter, fighter, hit.part, hit.dmg, fighter.weapon.def, fighter.weapon.def.name);
  if (res.hits.length) hud.setCrosshairGap(2 + fighter.weapon.bloom * 500);
}

function throwGrenade(fighter, kind) {
  if (!fighter.alive) return;
  if (fighter.grenades[kind] <= 0) return;
  fighter.grenades[kind] -= 1;
  const origin = { x: fighter.x, y: fighter.y + fighter.eye, z: fighter.z };
  const dir = {
    x: -Math.sin(fighter.yaw) * Math.cos(fighter.pitch),
    y: Math.sin(fighter.pitch),
    z: -Math.cos(fighter.yaw) * Math.cos(fighter.pitch),
  };
  util.throw(kind, origin, {
    x: dir.x * 13 + fighter.vx * 0.5,
    y: dir.y * 13 + 5,
    z: dir.z * 13 + fighter.vz * 0.5,
  }, fighter);
  hud.setGrenades(player.grenades);
}

function updatePlayer(dt) {
  if (!player.alive) return;
  weaponStep(player.weapon, dt);
  player.weapon.bloom = Math.max(0, player.weapon.bloom - dt * 0.06);
  // Movement: WASD relative to facing, shift to sprint (loud: bots hear),
  // C to crouch, space to jump. The player is a body with a collision
  // cylinder, not a camera: the walls push back.
  const sprinting = keys['ShiftLeft'] || keys['ShiftRight'];
  const baseSpeed = player.crouched ? MOVE.crouch : MOVE.walk;
  const speed = sprinting && !player.crouched ? MOVE.sprint : baseSpeed;
  let fx = 0;
  let fz = 0;
  if (keys['KeyW']) fz += 1;
  if (keys['KeyS']) fz -= 1;
  if (keys['KeyD']) fx += 1;
  if (keys['KeyA']) fx -= 1;
  const len = Math.hypot(fx, fz) || 1;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const wx = (-sin * fz + cos * fx) / len * (fx || fz ? speed : 0);
  const wz = (-cos * fz - sin * fx) / len * (fx || fz ? speed : 0);
  const groundY = groundHeightAt(player.x, player.z, colliders, player.y);
  if (player.grounded && keys['Space']) {
    player.vy = MOVE.jumpSpeed;
    player.grounded = false;
  }
  if (!player.grounded) {
    player.vy -= MOVE.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.grounded = true;
    }
  } else {
    player.y = groundY;
  }
  stepMover(player, wx, wz, dt, colliders, 30, 0.38);
  player.yaw -= lookDx * 0.0022;
  player.pitch -= lookDy * 0.0022;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
  lookDx = 0;
  lookDy = 0;
  if (keys['KeyC'] && !player._crouchHeld) {
    player.crouched = !player.crouched;
    player.height = player.crouched ? MOVE.crouchHeight : MOVE.standHeight;
    player.eye = player.crouched ? MOVE.crouchEye : MOVE.standEye;
    player._crouchHeld = true;
  }
  if (!keys['KeyC']) player._crouchHeld = false;
  if (time > playerFlashUntil) {
    hud.flashOverlay(0);
  } else {
    hud.flashOverlay(Math.min(1, (playerFlashUntil - time) / playerFlashDuration));
  }
  if (mouseDown) fireWeapon(player);
  if (player.weapon.reserve < player.weapon.def.mag && !weaponReady(player.weapon) && player.weapon.mag === 0) weaponReload(player.weapon);
  camera.position.set(player.x, player.y + player.eye, player.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  camera.rotation.z = 0;
  hud.setCrosshairGap(2 + player.weapon.bloom * 500 + (player.crouched ? -0.5 : 0));
  hud.setHealth(player.hp, player.armor);
  hud.setMoney(player.money);
  hud.setAmmo(player.weapon.mag, player.weapon.reserve, player.weapon.def.name);
  hud.setGrenades(player.grenades);
}

function updateBots(dt) {
  const cart = trackPosAt(payload.state.dist);
  const ctx = {
    dt,
    time,
    random: Math.random,
    colliders,
    bots,
    player,
    lastDeath,
    util,
    attacking: rounds.state.attacking,
    payloadPos: cart,
    payloadDist: payload.state.dist,
    phase: rounds.state.phase,
    onShoot(bot, res, origin, dir) {
      if (res.point) fx.tracer(origin, res.point, bot.weapon.def.tracer);
    },
    onDamage(shooter, victim, part, dmg, weaponDef, weaponName) {
      hurtFighter(victim, shooter, part, dmg, weaponDef, weaponName);
    },
    onThrow(kind, origin, vel, bot) {
      util.throw(kind, origin, vel, bot);
    },
  };
  for (const bot of bots) botStep(bot, ctx);
  // Bot kills count toward the tiebreak, so keep the round state fed.
  rounds.state.kills = {
    ember: player.kills + emberBots.reduce((s, b) => s + b.kills, 0),
    alloy: alloyBots.reduce((s, b) => s + b.kills, 0),
  };
}

// Grenades in flight: frags damage by distance from the blast (never the
// thrower), flashes blind whoever faces the blast, smokes just appear.
function stepUtility(dt) {
  util.step(dt, [...bots, player], time, {
    onFrag(grenade, fighters) {
      const center = { x: grenade.x, y: grenade.y, z: grenade.z };
      fx.burst(center, 0xffb347);
      for (const f of fighters) {
        if (!f.alive || f === grenade.owner) continue;
        const dist = Math.hypot(f.x - center.x, f.z - center.z);
        if (dist < GRENADES.frag.radius) {
          hurtFighter(f, grenade.owner, 'body', GRENADES.frag.damage * (1 - (dist / GRENADES.frag.radius) * 0.7), { damage: 1, headMult: 1 }, 'Frag');
        }
      }
    },
    onFlash(grenade, victims) {
      for (const v of victims) {
        if (v.fighter === player) {
          playerFlashUntil = time + v.seconds;
          playerFlashDuration = v.seconds;
        } else if (v.fighter.isBot) {
          v.fighter.blindUntil = time + v.seconds;
        }
      }
    },
    onSmoke(grenade) {
      void grenade;
    },
  });
}

function respawnFighter(fighter) {
  if (fighter.isBot) {
    const spawns = fighter.team === rounds.state.attacking ? SPAWNS.attack : SPAWNS.defend;
    const spawn = spawns[fighter.index % spawns.length];
    fighter.x = spawn[0];
    fighter.z = spawn[1];
    fighter.y = 0;
    fighter.hp = 100;
    fighter.alive = true;
    fighter.mesh.visible = true;
    fighter.mesh.position.set(fighter.x, 0, fighter.z);
  } else {
    const pSpawns = player.team === rounds.state.attacking ? SPAWNS.attack : SPAWNS.defend;
    player.x = pSpawns[2][0];
    player.z = pSpawns[2][1];
    player.y = 0;
    player.hp = 100;
    player.alive = true;
    player.crouched = false;
    player.height = MOVE.standHeight;
    player.eye = MOVE.standEye;
  }
}

function updateHud() {
  hud.setTimer(rounds.state.timeLeft > 0 ? `${Math.floor(rounds.state.timeLeft / 60)}:${String(Math.floor(rounds.state.timeLeft % 60)).padStart(2, '0')}` : '--:--');
  const cartPos = trackPosAt(payload.state.dist);
  hud.setPayload(payload.state, TRACK_LENGTH);
  hud.setScores(rounds.state.score.ember, rounds.state.score.alloy);
  // The cart rides its rail, and the checkpoint markers repaint from the
  // payload state — a passed checkpoint burns orange, the next one grey.
  cart.group.position.set(cartPos.x, 0, cartPos.z);
  cart.group.rotation.y = cartPos.angle;
  for (const key of Object.keys(checkpoints)) {
    const marker = checkpoints[key];
    const passed = payload.state.checkpoints[key].passed;
    const color = passed ? ownerColors.ember : ownerColors.neutral;
    marker.ring.material.color.copy(color);
    marker.letter.material.color.copy(color);
    marker.glow.color.copy(color);
  }
  const visibleBots = bots.map((b) => ({
    x: b.x, z: b.z, team: b.team, alive: b.alive,
    visible: b.alive && enemyVisibleOnMinimap(player, b, colliders, util),
  }));
  hud.updateMinimap({
    bots: visibleBots,
    player: { x: player.x, z: player.z, yaw: player.yaw, team: player.team },
    smokes: util.clouds(),
    payload: {
      checkpoints: payload.state.checkpoints,
      cartX: cartPos.x,
      cartZ: cartPos.z,
    },
  });
  hud.step(time);
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (!matchStarted) {
    hud.setPhase('DUSTLINE — click START to play');
    renderer.render(scene, camera);
    return;
  }
  // Mouse deltas for the viewmodel sway: updatePlayer consumes lookDx/lookDy
  // when it turns the camera, so snapshot them first.
  const mouseDx = lookDx;
  const mouseDy = lookDy;
  // Respawn: a dead fighter returns after 4 s at their spawn, with the gun
  // they had. A payload match is decided by presence, so nobody sits out.
  if (!player.alive && time > (player.respawnAt || 0)) respawnFighter(player);
  for (const bot of bots) {
    if (!bot.alive && time > (bot.respawnAt || 0)) respawnFighter(bot);
  }
  if (rounds.state.phase === 'live') {
    payload.step(dt, [...bots, player], rounds.state.attacking);
    updatePlayer(dt);
    updateBots(dt);
    stepUtility(dt);
  } else if (rounds.state.phase === 'buy') {
    updatePlayer(dt);
    updateBots(dt);
    stepUtility(dt);
  }
  fx.step(dt);
  viewmodel.step(dt, Math.hypot(player.vx, player.vz), mouseDx, mouseDy, false);
  if (viewmodelWeapon !== player.weapon.id) {
    viewmodel.setWeapon(player.weapon.id);
    viewmodelWeapon = player.weapon.id;
  }
  const emberAlive = (player.alive ? 1 : 0) + emberBots.reduce((s, b) => s + (b.alive ? 1 : 0), 0);
  const alloyAlive = alloyBots.reduce((s, b) => s + (b.alive ? 1 : 0), 0);
  rounds.step(dt, { payload: payload.state, kills: rounds.state.kills, emberAlive, alloyAlive }, () => {
    hud.setTimer('--:--');
  });
  updateHud();
  renderer.render(scene, camera);
}

// --- Input ---
const keys = {};
let mouseDown = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyB' && rounds.state.phase === 'buy') {
    if (hud.buyMenuVisible()) hud.hideBuyMenu();
    else hud.showBuyMenu(player.money, player.weapon.id, player.grenades, player.armor > 0);
  }
  if (e.code === 'KeyR') weaponReload(player.weapon);
  if (e.code === 'Digit4') throwGrenade(player, 'frag');
  if (e.code === 'Digit5') throwGrenade(player, 'flash');
  if (e.code === 'Digit6') throwGrenade(player, 'smoke');
  if (e.code === 'Digit1') {
    const order = ['longshot', 'rasp', 'maul', 'lance'];
    const cur = order.indexOf(player.weapon.id);
    const next = order[(cur + 1) % order.length];
    if (WEAPONS[next].price <= player.money || player.weapon.id === next) {
      player.weapon = createWeaponState(next);
      hud.setAmmo(player.weapon.mag, player.weapon.reserve, player.weapon.def.name);
    }
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousedown', (e) => {
  if (e.target.closest('#buy-menu')) return;
  if (e.button === 0) mouseDown = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
addEventListener('mousemove', (e) => {
  lookDx += e.movementX || 0;
  lookDy += e.movementY || 0;
});
addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-buy]');
  if (!btn || btn.disabled) return;
  const [kind, id] = btn.dataset.buy.split(':');
  if (kind === 'weapon') {
    const w = WEAPONS[id];
    if (player.money >= w.price) {
      player.money -= w.price;
      player.weapon = createWeaponState(id);
    }
  } else if (kind === 'util') {
    const g = GRENADES[id];
    if (player.money >= g.price) {
      player.money -= g.price;
      player.grenades[id] += 1;
    }
  } else if (kind === 'armor') {
    if (player.money >= ARMOR_PRICE) {
      player.money -= ARMOR_PRICE;
      player.armor = 100;
    }
  }
  hud.showBuyMenu(player.money, player.weapon.id, player.grenades, player.armor > 0);
  hud.setMoney(player.money);
  hud.setGrenades(player.grenades);
  hud.setAmmo(player.weapon.mag, player.weapon.reserve, player.weapon.def.name);
});

// --- Start screen + shot staging ---
function startMatch() {
  if (matchStarted) return;
  matchStarted = true;
  document.getElementById('start-screen').classList.add('hidden');
  rounds.start();
}

function placePlayerForShot(mode) {
  // 'start' is the odd one out: the start screen stays up and the match
  // does NOT start — the shot is the title, the briefing and the button,
  // with the yard behind it. Every other mode starts the match and stages
  // the requested moment.
  if (mode === 'start') return;
  matchStarted = true;
  document.getElementById('start-screen').classList.add('hidden');
  rounds.start();
  // 'play': jump straight into half 1 live, with the cart already at 20 m
  // (checkpoint A passed), bots riding the cart, and the player looking at
  // it from the rail bridge stairs.
  if (mode === 'play') {
    rounds.state.phase = 'live';
    rounds.state.timeLeft = 110;
    payload.state.dist = 20;
    payload.state.checkpoints.A.passed = true;
    payload.state.speed = 0;
    player.x = 0;
    player.z = -11;
    player.y = 3;
    player.yaw = Math.PI;
    player.pitch = -0.05;
    for (const bot of bots) {
      const cart = trackPosAt(20);
      bot.x = cart.x + (Math.random() - 0.5) * 6;
      bot.z = cart.z + (Math.random() - 0.5) * 6;
      bot.y = 0;
    }
    hud.setPhase('HALF 1 — EMBER ATTACKS · LIVE');
    hud.setPayload(payload.state, TRACK_LENGTH);
    hud.setScores(0, 0);
    hud.setRoundHistory(['-', '-']);
  } else if (mode === 'buy') {
    rounds.state.phase = 'buy';
    rounds.state.timeLeft = 15;
    hud.showBuyMenu(player.money, player.weapon.id, player.grenades, player.armor > 0);
    hud.setPhase('HALF 1 — EMBER ATTACKS · BUY PHASE');
  } else if (mode === 'end') {
    // Terminal phase 'end': the round clock ignores it, so no intermission
    // counts down into a phantom half 2 behind the end panel.
    rounds.state.phase = 'end';
    rounds.state.matchOver = true;
    rounds.state.timeLeft = 0;
    rounds.state.score = { ember: 1, alloy: 0 };
    rounds.state.results = {
      ember: { dist: 64.5, time: 98.4 },
      alloy: { dist: 41.2, time: null },
    };
    rounds.state.winner = 'ember';
    handleRoundEvent('match-end', { results: rounds.state.results, score: rounds.state.score, winner: 'ember', history: ['E', '-'] });
    // Step the camera off the cart's back: the spawn sits 2 m behind the
    // cart, so a raw end shot is mostly orange cargo. From the side the
    // yard, the rail and the bridge read behind the panel instead.
    player.x = -23;
    player.z = 16;
    player.yaw = -0.7;
    player.pitch = 0;
  }
}

document.getElementById('start-btn').addEventListener('click', () => {
  document.body.requestPointerLock?.();
  startMatch();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Debug handle for the headless harness: a bot that has not died, the
// payload state, and the round state are all readable from the console.
window.__dustline = {
  state: () => ({
    phase: rounds.state.phase,
    half: rounds.state.half,
    attacking: rounds.state.attacking,
    timeLeft: rounds.state.timeLeft,
    score: rounds.state.score,
    payload: payload.state,
    player: { x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, hp: player.hp, alive: player.alive, kills: player.kills, money: player.money },
    bots: bots.map((b) => ({ team: b.team, role: b.role, x: b.x, y: b.y, z: b.z, hp: b.hp, alive: b.alive, kills: b.kills, money: b.money, weapon: b.weapon.id })),
  }),
};

if (shotMode) placePlayerForShot(shotMode);
requestAnimationFrame(loop);
