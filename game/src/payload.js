// The payload: the objective. A cart on the rail, pushed by the attackers
// and frozen by the defenders. The cart moves only while at least one
// attacker stands in its push ring and no defender stands in its contest
// ring; more attackers push it faster, to a cap. It never rolls back —
// ground taken is ground kept. Passing a checkpoint is automatic when the
// cart's distance reaches it: the checkpoint flips, the round clock gains
// bonus time, and the attacking team banks a bonus. This module owns only
// the cart; the round clock in rounds.js decides when a distance ends a
// round or a match, and main.js owns who stands where. The cart state is
// deliberately boring on purpose: distance, speed, who is pushing — one
// place, no copies, so the HUD, the minimap, the cart mesh and the
// checkpoint markers can never disagree about where the cart is.
import { ROUND, TRACK } from './config.js';
import { trackPosAt, TRACK_LENGTH } from './map.js';

export function createPayload({ onEvent }) {
  const state = {
    dist: 0, // metres along the track
    speed: 0, // m/s right now
    pushing: 0, // attackers in the push ring
    contested: false,
    finished: false,
    finishTime: null, // live seconds elapsed when the cart arrived
    elapsed: 0,
    checkpoints: {
      A: { passed: false },
      B: { passed: false },
      C: { passed: false },
    },
  };

  function emit(type, data) { onEvent(type, data); }

  function pos() {
    return trackPosAt(state.dist);
  }

  return {
    state,
    pos,
    trackLength: TRACK_LENGTH,
    reset() {
      state.dist = 0;
      state.speed = 0;
      state.pushing = 0;
      state.contested = false;
      state.finished = false;
      state.finishTime = null;
      state.elapsed = 0;
      for (const key of Object.keys(state.checkpoints)) state.checkpoints[key].passed = false;
    },
    // `fighters` are the alive fighters of both teams, each with x/z/team.
    // `attacking` is the team pushing this half. The cart moves on presence
    // alone: no key to hold, no bomb to plant.
    step(dt, fighters, attacking) {
      if (state.finished) return;
      state.elapsed += dt;
      const cart = pos();
      let attackers = 0;
      let defenders = 0;
      const defending = attacking === 'ember' ? 'alloy' : 'ember';
      for (const f of fighters) {
        if (!f.alive) continue;
        const d = Math.hypot(f.x - cart.x, f.z - cart.z);
        if (f.team === attacking && d <= ROUND.pushRadius) attackers += 1;
        else if (f.team === defending && d <= ROUND.contestRadius) defenders += 1;
      }
      state.pushing = attackers;
      state.contested = defenders > 0;
      // A defender in the ring freezes the cart, however many attackers
      // push: the fight has to be won before the cart moves again.
      if (defenders > 0 || attackers === 0) {
        state.speed = 0;
        return;
      }
      state.speed = Math.min(
        ROUND.cartMaxSpeed,
        ROUND.cartBaseSpeed + (attackers - 1) * ROUND.cartBonusPerAlly,
      );
      state.dist += state.speed * dt;
      // Checkpoints: the cart passing one flips it, pays the attackers time
      // and money, and tells the HUD to cheer.
      for (const cp of TRACK.checkpoints) {
        if (!state.checkpoints[cp.key].passed && state.dist >= cp.dist) {
          state.checkpoints[cp.key].passed = true;
          emit('checkpoint', { point: cp.key, name: cp.name, dist: state.dist, timeLeftBonus: ROUND.bonusSeconds });
        }
      }
      if (state.dist >= TRACK_LENGTH) {
        state.dist = TRACK_LENGTH;
        state.finished = true;
        state.finishTime = state.elapsed;
        state.speed = 0;
        emit('delivered', { dist: state.dist, time: state.finishTime });
      }
    },
    passedCount() {
      let n = 0;
      for (const key of Object.keys(state.checkpoints)) if (state.checkpoints[key].passed) n += 1;
      return n;
    },
  };
}
