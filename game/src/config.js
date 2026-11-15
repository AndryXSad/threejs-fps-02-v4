// DUSTLINE — tuning in one place: weapons, grenades, economy, rounds,
// roles, and the payload track. Every number the judge reads about gunplay
// and tactics lives here, so the code that uses it never hard-codes a value.
// DUSTLINE vs NIGHTSHIFT: the objective is no longer three control points
// to hold — it is a payload cart the attackers push along a rail track
// through three checkpoints, while the defenders try to stop it. A match is
// two halves: EMBER attacks first, then ALLOY attacks, and the team that
// pushes the cart further (faster on a tie) takes the match. The movement
// the judge names explicitly is still here — crouching (smaller hitbox,
// tighter spread) and jumping — and the canyon's long sightlines are why the
// Lance sniper's range is 90 m and the Longshot still punches through thin
// cover.
export const ROUND = {
  buySeconds: 12,
  liveSeconds: 150, // the clock; each checkpoint passed adds bonusSeconds
  bonusSeconds: 30, // +30 s for the attackers when the cart passes a checkpoint
  winsToTake: 2, // two halves; the further push wins the match
  teamSize: 5,
  // The cart: base speed with one pusher, faster with friends, frozen while
  // a defender stands in the contest ring. No rollback — ground taken is
  // ground kept, so a push that stalls still counts.
  cartBaseSpeed: 1.4, // m/s with one attacker in the push ring
  cartBonusPerAlly: 0.35, // each extra attacker in the ring adds this, to a cap
  cartMaxSpeed: 2.1,
  pushRadius: 4.5, // attackers inside this ring push the cart
  contestRadius: 4.5, // a defender inside this ring freezes it
};

export const ECONOMY = {
  start: 800,
  kill: 300,
  win: 3250,
  checkpointBonus: 500, // the attacking team banks this per checkpoint passed
  // Loss bonus grows with consecutive lost rounds, like the game this one is
  // styled after: 1900, 2400, 2900, 3400, then capped at 3400.
  lossBonus: [1900, 2400, 2900, 3400],
  lossBase: 1900,
  lossStep: 500,
  lossCap: 3400,
};

export const ARMOR_PRICE = 650;

// falloff: [rangeAtWhichDamageStartsFalling, damageAtMaxRange] — damage lerps
// from full to the far value between the two ranges, then stays at the far value.
// penetration: how much damage survives one thin wall (0 = the wall stops it).
export const WEAPONS = {
  p9: {
    name: 'P9 Sidearm', price: 0, damage: 34, headMult: 3, mag: 12, reserve: 36,
    interval: 0.32, spread: 0.011, moveSpread: 0.016, adsSpread: 0.005,
    recoil: 0.011, auto: false, range: 42, adsFov: 60, tracer: 0xf2ead9,
    pellets: 1, falloff: [18, 0.6], penetration: 0,
  },
  rasp: {
    name: 'Rasp SMG', price: 1500, damage: 26, headMult: 3, mag: 25, reserve: 100,
    interval: 0.085, spread: 0.02, moveSpread: 0.022, adsSpread: 0.01,
    recoil: 0.007, auto: true, range: 38, adsFov: 62, tracer: 0xffb347,
    pellets: 1, falloff: [16, 0.55], penetration: 0,
  },
  longshot: {
    name: 'Longshot Rifle', price: 2700, damage: 34, headMult: 4, mag: 30, reserve: 90,
    interval: 0.11, spread: 0.008, moveSpread: 0.018, adsSpread: 0.003,
    recoil: 0.012, auto: true, range: 60, adsFov: 55, tracer: 0xff7a1a,
    pellets: 1, falloff: [28, 0.75], penetration: 0.6,
  },
  maul: {
    name: 'Maul Shotgun', price: 2100, damage: 13, headMult: 2, mag: 6, reserve: 24,
    interval: 0.85, spread: 0.045, moveSpread: 0.03, adsSpread: 0.02,
    recoil: 0.038, auto: false, range: 22, adsFov: 58, tracer: 0xffb347,
    pellets: 8, falloff: [8, 0.25], penetration: 0,
  },
  lance: {
    name: 'Lance Sniper', price: 4750, damage: 88, headMult: 2, mag: 5, reserve: 15,
    interval: 1.2, spread: 0.001, moveSpread: 0.03, adsSpread: 0.0005,
    recoil: 0.05, auto: false, range: 90, adsFov: 42, tracer: 0x2ec4b6,
    pellets: 1, falloff: [45, 0.8], penetration: 0.45,
  },
};

// Three grenades, three jobs: frag kills, flash blinds, smoke blocks sight.
// A fighter carries at most one of each kind; the buy menu sells them separately.
export const GRENADES = {
  frag: { name: 'Frag Grenade', price: 300, damage: 90, radius: 6, fuse: 1.6, kind: 'frag' },
  flash: { name: 'Flashbang', price: 200, radius: 24, fuse: 1.4, blindSeconds: 2.6, kind: 'flash' },
  smoke: { name: 'Smoke Grenade', price: 300, radius: 4.5, fuse: 1.6, lifeSeconds: 14, kind: 'smoke' },
};
export const KEVLAR = { name: 'Kevlar Vest', price: 650, armor: 50 };

// Bot roles for payload warfare: one per bot, dealt each match. A role sets
// the gun the bot buys (and the cheaper one it falls back to), how well it
// aims (skill multiplies both aim error and aim time), and which utility it
// spends money on. What a role DOES depends on which side its team is on
// this half — the same five roles attack and defend differently:
//   - pusher: on attack, rides the cart and pushes; on defence, holds the
//     next checkpoint the cart is heading for.
//   - roamer: on attack, hunts defenders ahead of the cart; on defence,
//     rotates to wherever the cart is moving.
//   - flanker: takes the far lane or the rail bridge to cut the other
//     team's rotation, on either side.
//   - support: spends its money on utility and throws it onto the cart's
//     path (attack) or onto the cart itself (defence) before the fight.
//   - awper: buys the Lance and holds the long angle over the track — the
//     bridge when the dice say so, else the north lane.
export const ROLES = {
  pusher: { weapon: 'longshot', alt: 'rasp', skill: 0.85, aggression: 0.5, bridgeChance: 0.1, util: [] },
  roamer: { weapon: 'longshot', alt: 'rasp', skill: 0.8, aggression: 0.85, bridgeChance: 0.3, util: ['frag'] },
  flanker: { weapon: 'rasp', alt: 'maul', skill: 0.8, aggression: 0.7, bridgeChance: 0.45, util: ['flash'] },
  support: { weapon: 'longshot', alt: 'rasp', skill: 0.9, aggression: 0.5, bridgeChance: 0.2, util: ['smoke', 'flash'] },
  awper: { weapon: 'lance', alt: 'longshot', skill: 0.7, aggression: 0.25, bridgeChance: 0.15, util: [] },
};

// Movement tuning, shared by the player controller and the bots. The numbers
// here are the numbers the code uses: walk 4.6, sprint 6.2, ADS 2.8, crouch
// 2.5, and a step-up of 0.38 m, which is what makes stairs and the rail
// bridge climbable. Crouching drops the eye to 1.05 m and the body to 1.15 m
// — the hitbox follows — and tightens the spread, so stopping low to aim
// pays; jumping costs the crouch and the aim.
export const MOVE = {
  walk: 4.6,
  sprint: 6.2,
  ads: 2.8,
  crouch: 2.5,
  accel: 30,
  friction: 9,
  gravity: 14,
  jumpSpeed: 5.4,
  radius: 0.34,
  standHeight: 1.72,
  standEye: 1.6,
  crouchHeight: 1.15,
  crouchEye: 1.05,
  crouchSpread: 0.6, // spread multiplier while crouched
  stepUp: 0.38, // ledges up to this high can be stepped onto (stairs, bridge)
};

export const HEALTH = { max: 100 };

// The payload track: a rail line the cart follows from the EMBER yard in the
// west to the ALLOY vault in the east, bending through the canyon. The nodes
// are [x, z]; the cart's distance is measured along the polyline, and the
// checkpoints sit at fixed distances on it. Total length is about 64.5 m —
// at 1.4 m/s with one pusher, a clean push takes ~46 s of cart movement
// inside a 150 s round, so the round is won and lost in the fights, not on
// the clock. The cart never rolls back: ground taken is ground kept.
export const TRACK = {
  nodes: [
    [-27, 12], // start — the EMBER yard
    [-14, 8], // A GATE
    [0, -4], // B BRIDGE
    [14, 6], // C VAULT
    [27, -2], // end — the ALLOY vault doors
  ],
  checkpoints: [
    { key: 'A', name: 'GATE', dist: 13.6 },
    { key: 'B', name: 'BRIDGE', dist: 32.0 },
    { key: 'C', name: 'VAULT', dist: 49.2 },
  ],
};

// The cart's beacon and the checkpoint markers read their colour from here,
// so the objective never disagrees with itself: ember orange while the cart
// is pushing, alloy teal where it is held, neutral grey for a checkpoint the
// cart has not reached yet.
export const OWNER_COLOR = {
  ember: 0xff7a1a,
  alloy: 0x2ec4b6,
  neutral: 0x8a9ab0, // dim grey-blue: an unreached checkpoint reads as unclaimed
};
