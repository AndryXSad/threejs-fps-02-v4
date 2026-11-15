// HUD: everything the player sees that is not the world. Crosshair with a
// dynamic gap (it opens as the gun blooms), health/armour/money/ammo, the
// grenade slots, the round history strip, the minimap — and two things the
// game did not have before: a hit-direction indicator that points at whoever
// just shot you, and a white flash overlay for when a flashbang catches you.
// New in DUSTLINE: the track bar under the top bar — a rail line with three
// checkpoint ticks and a cart marker that rides it, so the state of the
// objective is always one glance away. The top bar shows halves won, not
// metres: the metres live on the track bar.
import { TRACK } from './config.js';
import { WEAPONS, GRENADES, ARMOR_PRICE } from './config.js';
import { rayHitDistance } from './map.js';

const WALL_RECTS = [
  [-10, -16, 10, 1.5], [12, -16, 8, 1.5],
  [-8, -9, 1.4, 1.4], [7, -9, 1.4, 1.4], [-24, -4, 1.2, 1.2], [24, -4, 1.2, 1.2],
  [-16, 3, 4.5, 2.2], [-12, 13, 4.5, 2.2], [-5, -10, 4.5, 2.2], [5, 2, 4.5, 2.2],
  [12, 11, 4.5, 2.2], [18, 1, 4.5, 2.2], [29, -6, 3, 2], [25, -9, 2, 2],
  [-22, 8, 2, 2], [-22, 16, 2, 2], [22, -8, 2, 2], [22, 6, 2, 2],
  [-4, 10, 2.4, 1.4], [8, 12, 2.4, 1.4], [-10, -10, 2, 2], [10, -12, 2, 2],
  [-26, 6, 2, 2], [26, -12, 2, 2],
  [-19, 4, 6, 1], [4, 0, 6, 1],
  [-1.5, -11, 0.8, 0.8], [1.5, -11, 0.8, 0.8], [-1.5, 3, 0.8, 0.8], [1.5, 3, 0.8, 0.8],
];

export function createHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="crosshair"><span class="ch-dot"></span><span class="ch-line ch-t"></span><span class="ch-line ch-b"></span><span class="ch-line ch-l"></span><span class="ch-line ch-r"></span></div>
    <div id="hitdir"></div>
    <div id="flash-overlay"></div>
    <div id="damage-vignette"></div>
    <div id="topbar"><span id="score-ember">EMBER 0</span><span id="timer">--:--</span><span id="score-alloy">0 ALLOY</span></div>
    <div id="track-bar"><div id="track-line"></div><div id="track-cart"></div><span class="tk" style="left:21%">A</span><span class="tk" style="left:50%">B</span><span class="tk" style="left:76%">C</span></div>
    <div id="track-dist">CART 0.0 m / 64.5 m</div>
    <div id="round-history"></div>
    <div id="phase">DUSTLINE</div>
    <div id="message"></div>
    <div id="minimap-wrap"><canvas id="minimap" width="180" height="124"></canvas></div>
    <div id="stats">
      <div id="health">100</div>
      <div id="armor">0</div>
      <div id="money">$800</div>
      <div id="ammo">30 / 90</div>
      <div id="weapon-name">Longshot Rifle</div>
      <div id="grenades"></div>
    </div>
    <div id="killfeed"></div>
    <div id="buy-menu" class="hidden"></div>
    <div id="end-panel" class="hidden"></div>
  `;
  const el = (id) => document.getElementById(id);
  const ctx = el('minimap').getContext('2d');
  const W = 180;
  const H = 124;
  const scaleX = W / 68;
  const scaleZ = H / 48;
  const toMap = (x, z) => [(x + 34) * scaleX, (z + 24) * scaleZ];
  let hitDirAngle = null;
  let hitDirUntil = 0;

  function drawMinimap(state) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(200,160,106,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#6b5a44';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    // The rail bridge: a raised strip over checkpoint B, drawn lighter.
    ctx.fillStyle = 'rgba(110,90,64,0.6)';
    const [gx, gz] = toMap(0, -4);
    ctx.fillRect(gx - (2.4 / 2) * scaleX, gz - (16 / 2) * scaleZ, 2.4 * scaleX, 16 * scaleZ);
    ctx.fillStyle = 'rgba(90,70,48,0.7)';
    for (const [x, z, w, d] of WALL_RECTS) {
      const [mx, mz] = toMap(x - w / 2, z - d / 2);
      ctx.fillRect(mx, mz, w * scaleX, d * scaleZ);
    }
    // The rail line itself: a dark line the cart rides, with checkpoint
    // ticks in the checkpoint's state colour.
    ctx.strokeStyle = '#3a3a3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    TRACK.nodes.forEach(([x, z], i) => {
      const [mx, mz] = toMap(x, z);
      if (i === 0) ctx.moveTo(mx, mz);
      else ctx.lineTo(mx, mz);
    });
    ctx.stroke();
    if (state.payload) {
      for (const cp of TRACK.checkpoints) {
        const node = TRACK.nodes[TRACK.checkpoints.indexOf(cp) + 1];
        const [mx, mz] = toMap(node[0], node[1]);
        ctx.fillStyle = state.payload.checkpoints[cp.key].passed ? '#ff7a1a' : '#5a6a80';
        ctx.beginPath();
        ctx.arc(mx, mz, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // The cart: an orange dot on the rail, bigger than a checkpoint.
      const [cx, cz] = toMap(state.payload.cartX, state.payload.cartZ);
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.arc(cx, cz, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a0d00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Smoke clouds: grey blobs that hide whatever is behind them.
    if (state.smokes) {
      ctx.fillStyle = 'rgba(168,154,130,0.6)';
      for (const c of state.smokes) {
        const [mx, mz] = toMap(c.x, c.z);
        ctx.beginPath();
        ctx.arc(mx, mz, c.r * scaleX, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const drawDot = (x, z, color, size = 3) => {
      const [mx, mz] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, mz, size, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const bot of state.bots) {
      if (!bot.alive) continue;
      if (bot.team === state.player.team) {
        drawDot(bot.x, bot.z, '#2e6b62', 3);
      } else if (bot.visible) {
        drawDot(bot.x, bot.z, '#ff5533', 3);
      }
    }
    // The player: a wedge that points where they look.
    const [px, pz] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(-Math.sin(state.player.yaw), -Math.cos(state.player.yaw)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    showMessage(text, ms = 2500) {
      const m = el('message');
      m.textContent = text;
      m.classList.add('show');
      clearTimeout(m._t);
      m._t = setTimeout(() => m.classList.remove('show'), ms);
    },
    setPhase(text) { el('phase').textContent = text; },
    setTimer(text) { el('timer').textContent = text; },
    // The top bar shows halves won (first to take the further push wins the
    // match); the metres live on the track bar below it.
    setScores(e, a) {
      el('score-ember').textContent = `EMBER ${e}`;
      el('score-alloy').textContent = `${a} ALLOY`;
    },
    // The track bar: the cart marker rides the rail line, the checkpoint
    // ticks flip orange as the cart passes them, and the distance readout
    // says exactly how far the cart has come.
    setPayload(payload, trackLength) {
      const pct = Math.min(100, (payload.dist / trackLength) * 100);
      el('track-cart').style.left = `${pct}%`;
      el('track-cart').classList.toggle('contested', !!payload.contested);
      el('track-dist').textContent = `CART ${payload.dist.toFixed(1)} m / ${trackLength.toFixed(1)} m${payload.contested ? ' — CONTESTED' : payload.pushing > 0 ? ` — PUSHING ×${payload.pushing}` : ''}`;
      const ticks = el('track-bar').querySelectorAll('.tk');
      TRACK.checkpoints.forEach((cp, i) => {
        ticks[i].classList.toggle('passed', !!payload.checkpoints[cp.key].passed);
      });
    },
    setRoundHistory(history) {
      const wrap = el('round-history');
      wrap.innerHTML = history.map((h) => `<span class="rh ${h === 'E' ? 'rh-e' : h === 'A' ? 'rh-a' : ''}">${h === 'E' ? 'E' : h === 'A' ? 'A' : '–'}</span>`).join('');
    },
    setHealth(hp, armor) {
      el('health').textContent = Math.ceil(hp);
      el('health').style.color = hp <= 30 ? '#ff5533' : '#ffffff';
      el('armor').textContent = Math.ceil(armor);
    },
    setMoney(m) { el('money').textContent = `$${m}`; },
    setAmmo(mag, reserve, name) {
      el('ammo').textContent = `${mag} / ${reserve}`;
      el('weapon-name').textContent = name;
    },
    setGrenades(g) {
      el('grenades').innerHTML = Object.entries(GRENADES).map(([kind, def]) => (
        `<span class="gren ${g[kind] > 0 ? 'has' : ''}">${def.name.split(' ')[0]} ×${g[kind]}</span>`
      )).join(' ');
    },
    setCrosshairGap(px) {
      document.documentElement.style.setProperty('--ch-gap', `${px}px`);
    },
    hitDirection(angle, time) {
      hitDirAngle = angle;
      hitDirUntil = time + 0.9;
      const d = el('hitdir');
      d.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
      d.classList.add('show');
    },
    flashOverlay(strength) {
      el('flash-overlay').style.opacity = String(Math.min(1, strength));
    },
    damageFlash() {
      const v = el('damage-vignette');
      v.classList.remove('show');
      void v.offsetWidth;
      v.classList.add('show');
    },
    addKill(text, color = '#ffffff') {
      const feed = el('killfeed');
      const line = document.createElement('div');
      line.className = 'kill-line';
      line.style.color = color;
      line.textContent = text;
      feed.prepend(line);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      setTimeout(() => line.remove(), 6000);
    },
    showBuyMenu(money, currentWeapon, grenades, hasArmor) {
      const menu = el('buy-menu');
      const weaponRows = Object.values(WEAPONS).map((w) => (
        `<button class="buy-item ${currentWeapon === w.id ? 'current' : ''}" data-buy="weapon:${w.id}" ${money < w.price && currentWeapon !== w.id ? 'disabled' : ''}>
          <span class="buy-name">${w.name}</span><span class="buy-stat">${w.damage} dmg · ${w.range} m · ${w.mag} rnd</span><span class="buy-price">$${w.price}</span>
        </button>`
      )).join('');
      const utilRows = Object.entries(GRENADES).map(([kind, def]) => (
        `<button class="buy-item" data-buy="util:${kind}" ${money < def.price ? 'disabled' : ''}>
          <span class="buy-name">${def.name}</span><span class="buy-stat">${kind === 'frag' ? 'blast damage' : kind === 'flash' ? 'blinds 2.6 s' : 'blocks sight 14 s'}</span><span class="buy-price">$${def.price}</span>
        </button>`
      )).join('');
      menu.innerHTML = `
        <h2>BUY — $${money}</h2>
        <div class="buy-section">${weaponRows}</div>
        <div class="buy-section">${utilRows}
          <button class="buy-item" data-buy="armor" ${money < ARMOR_PRICE || hasArmor ? 'disabled' : ''}>
            <span class="buy-name">Kevlar Vest</span><span class="buy-stat">absorbs half of damage</span><span class="buy-price">$${ARMOR_PRICE}</span>
          </button>
        </div>
        <p class="buy-hint">Click to buy · B to close · grenades: 4 frag · 5 flash · 6 smoke</p>`;
      menu.classList.remove('hidden');
    },
    hideBuyMenu() { el('buy-menu').classList.add('hidden'); },
    buyMenuVisible() { return !el('buy-menu').classList.contains('hidden'); },
    showEnd(title, lines) {
      const panel = el('end-panel');
      panel.innerHTML = `<h2>${title}</h2>${lines.map((l) => `<p>${l}</p>`).join('')}<p class="buy-hint">Refresh to play again</p>`;
      panel.classList.remove('hidden');
    },
    hideEnd() { el('end-panel').classList.add('hidden'); },
    updateMinimap(state) { drawMinimap(state); },
    step(time) {
      if (hitDirAngle !== null && time > hitDirUntil) {
        el('hitdir').classList.remove('show');
        hitDirAngle = null;
      }
    },
  };
}

// An enemy is drawn on the minimap only when the player could plausibly know
// they are there: line of sight is open, no smoke in the way, and they are
// within 30 m. A kill in the last 4 s also reveals the victim's killer.
export function enemyVisibleOnMinimap(player, enemy, colliders, util) {
  const dx = enemy.x - player.x;
  const dy = (enemy.y + 1.2) - (player.y + player.eye);
  const dz = enemy.z - player.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > 30) return false;
  const len = dist || 1;
  const wall = rayHitDistance(colliders, player.x, player.y + player.eye, player.z, dx / len, dy / len, dz / len, dist);
  if (wall < dist - 0.05) return false;
  if (util && util.blocksSight({ x: player.x, y: player.y + player.eye, z: player.z }, { x: enemy.x, y: enemy.y + 1.2, z: enemy.z })) return false;
  return true;
}
