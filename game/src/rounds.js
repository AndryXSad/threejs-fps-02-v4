// Rounds: the match clock. A match is two halves. In half 1 EMBER attacks
// (pushes the cart) and ALLOY defends; in half 2 they swap, and the team
// that pushed the cart further takes the match — faster on a tie, kills on
// a further tie, a draw if even that is level. A half is a buy phase and a
// live phase. A live half ends four ways: the cart reaches the vault
// (attackers take the half), the clock runs out (defenders take it at the
// distance the cart reached), or one team is eliminated. The economy lives
// here in one place: winners bank 3250, losers take a loss bonus that grows
// with the streak (1900/2400/2900/3400), and the half history the HUD draws
// comes from here too. Nothing here knows about control points: there are
// none in this game, and no bomb either.
import { ROUND } from './config.js';

const WIN_ROUNDS = ROUND.winsToTake;
const ROUND_TIME = ROUND.liveSeconds;
const BUY_TIME = ROUND.buySeconds;
const LOSS_BONUS = [1900, 2400, 2900, 3400];

export function createRounds({ onEvent }) {
  const state = {
    phase: 'idle',
    half: 0, // 1 = EMBER attacks, 2 = ALLOY attacks
    attacking: 'ember',
    score: { ember: 0, alloy: 0 }, // halves won
    history: [],
    timeLeft: 0,
    matchOver: false,
    overT: 0,
    lossStreak: { ember: 0, alloy: 0 },
    // What each team pushed, in metres, and how long it took them to finish
    // (null when the cart never arrived). The match is decided on these.
    results: {
      ember: { dist: 0, time: null },
      alloy: { dist: 0, time: null },
    },
  };

  function emit(type, data) { onEvent(type, data); }

  function endHalf(winner, reason, ctx) {
    if (state.phase === 'over' || state.phase === 'end') return;
    const attacking = state.attacking;
    const defending = attacking === 'ember' ? 'alloy' : 'ember';
    const payload = ctx.payload || { dist: 0, elapsed: 0, finished: false, finishTime: null };
    state.results[attacking] = {
      dist: payload.dist,
      time: payload.finished ? payload.finishTime : null,
    };
    state.score[winner] += 1;
    state.history.push(winner === 'ember' ? 'E' : 'A');
    state.lossStreak[winner] = 0;
    const loser = winner === 'ember' ? 'alloy' : 'ember';
    const bonus = LOSS_BONUS[Math.min(state.lossStreak[loser], 3)];
    state.lossStreak[loser] += 1;
    emit('round-end', {
      winner, reason, score: { ...state.score }, history: [...state.history],
      lossBonus: bonus, loser, half: state.half, attacking,
      dist: payload.dist, defending,
    });
    if (state.half >= WIN_ROUNDS) {
      // The match is decided on distance pushed, then time, then kills.
      const e = state.results.ember;
      const a = state.results.alloy;
      let matchWinner = null;
      if (e.dist !== a.dist) matchWinner = e.dist > a.dist ? 'ember' : 'alloy';
      else if (e.time !== null && a.time !== null && e.time !== a.time) matchWinner = e.time < a.time ? 'ember' : 'alloy';
      else if ((ctx.kills?.ember ?? 0) !== (ctx.kills?.alloy ?? 0)) matchWinner = (ctx.kills?.ember ?? 0) > (ctx.kills?.alloy ?? 0) ? 'ember' : 'alloy';
      state.matchOver = true;
      state.phase = 'end';
      emit('match-end', {
        winner: matchWinner, score: { ...state.score }, history: [...state.history],
        results: { ember: { ...e }, alloy: { ...a } },
      });
      return;
    }
    state.phase = 'over';
    state.overT = 4;
  }

  return {
    state,
    start() {
      state.half = 0;
      state.attacking = 'ember';
      state.score = { ember: 0, alloy: 0 };
      state.history = [];
      state.lossStreak = { ember: 0, alloy: 0 };
      state.results = { ember: { dist: 0, time: null }, alloy: { dist: 0, time: null } };
      state.matchOver = false;
      this.startRound();
    },
    startRound() {
      state.half += 1;
      state.attacking = state.half === 1 ? 'ember' : 'alloy';
      state.phase = 'buy';
      state.timeLeft = BUY_TIME;
      emit('buy-start', { half: state.half, attacking: state.attacking, score: { ...state.score }, history: [...state.history] });
    },
    beginLive() {
      if (state.phase !== 'buy') return;
      state.phase = 'live';
      state.timeLeft = ROUND_TIME;
      emit('live-start', { half: state.half, attacking: state.attacking });
    },
    // A checkpoint passed adds bonus time to the live clock.
    addTime(seconds) {
      if (state.phase === 'live') state.timeLeft += seconds;
    },
    // The clock. `ctx` carries the live headcounts, the payload state and
    // the kill totals; the caller owns movement, pushing and shooting, this
    // owns only time.
    step(dt, ctx) {
      if (state.phase === 'buy') {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) this.beginLive();
        return;
      }
      if (state.phase === 'over') {
        state.overT -= dt;
        if (state.overT <= 0 && !state.matchOver) this.startRound();
        return;
      }
      if (state.phase !== 'live' && state.phase !== 'end') return;
      if (state.phase === 'end') return;
      state.timeLeft -= dt;
      const payload = ctx.payload || { dist: 0, finished: false };
      const attacking = state.attacking;
      const defending = attacking === 'ember' ? 'alloy' : 'ember';
      // The cart arrived: the attackers take the half at full distance.
      if (payload.finished) { endHalf(attacking, 'Payload delivered — the vault doors are open', ctx); return; }
      if (state.timeLeft <= 0) {
        endHalf(defending, `Time expired — payload held at ${payload.dist.toFixed(1)} m`, ctx);
        return;
      }
      const attackersAlive = attacking === 'ember' ? ctx.emberAlive : ctx.alloyAlive;
      const defendersAlive = attacking === 'ember' ? ctx.alloyAlive : ctx.emberAlive;
      if (attackersAlive === 0) { endHalf(defending, 'Attackers eliminated'); return; }
      if (defendersAlive === 0) { endHalf(attacking, 'Defenders eliminated'); return; }
    },
  };
}
