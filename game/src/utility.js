// Utility: the three grenades. Frag kills, flash blinds, smoke blocks sight.
// A fighter carries at most one of each kind; the buy menu sells them
// separately and the bots spend their own money on them too. Smoke is the one
// that changes tactics: a cloud is a real obstacle to sight — bots cannot see
// through it, the minimap stops showing enemies behind it, and a push through
// it is a blind push. All three fly the same ballistic arc with one bounce.
import * as THREE from 'three';
import { GRENADES } from './config.js';
import { rayHitDistance } from './map.js';

const CLOUD_POOL = 3;
const PUFFS_PER_CLOUD = 5;

export function createUtility(scene, colliders) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a22, roughness: 0.4, metalness: 0.6 }),
  );
  mesh.visible = false;
  scene.add(mesh);
  const blastLight = new THREE.PointLight(0xffb347, 0, 14, 1.6);
  scene.add(blastLight);
  // Smoke clouds: pooled puffs of grey, one cloud per live smoke grenade.
  const clouds = [];
  for (let i = 0; i < CLOUD_POOL; i += 1) {
    const puffs = [];
    for (let j = 0; j < PUFFS_PER_CLOUD; j += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a8378, transparent: true, opacity: 0, roughness: 1, depthWrite: false }),
      );
      puff.visible = false;
      scene.add(puff);
      puffs.push(puff);
    }
    clouds.push({ puffs, until: 0, x: 0, y: 0, z: 0, r: 0, active: false });
  }
  const active = [];

  function segmentHitsSphere(from, to, cx, cy, cz, r) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const fx = from.x - cx;
    const fy = from.y - cy;
    const fz = from.z - cz;
    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * (fx * dx + fy * dy + fz * dz);
    const c = fx * fx + fy * fy + fz * fz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1;
  }

  return {
    // True when a smoke cloud sits between two points. Bots ask this before
    // they trust their eyes; the minimap asks it before it draws an enemy.
    blocksSight(from, to) {
      for (const c of clouds) {
        if (!c.active) continue;
        if (segmentHitsSphere(from, to, c.x, c.y + 0.8, c.z, c.r)) return true;
      }
      return false;
    },
    clouds() {
      return clouds.filter((c) => c.active);
    },
    throw(kind, from, vel, owner) {
      const def = GRENADES[kind];
      active.push({ kind, x: from.x, y: from.y, z: from.z, vx: vel.x, vy: vel.y, vz: vel.z, fuse: def.fuse, owner });
    },
    step(dt, fighters, time, events) {
      mesh.visible = active.length > 0;
      if (active.length) {
        const g = active[0];
        mesh.position.set(g.x, g.y, g.z);
      }
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const g = active[i];
        g.fuse -= dt;
        g.vy -= 14 * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.z += g.vz * dt;
        if (g.y < 0.09) { g.y = 0.09; g.vy = Math.abs(g.vy) * 0.35; g.vx *= 0.6; g.vz *= 0.6; }
        if (g.fuse <= 0) {
          active.splice(i, 1);
          const def = GRENADES[g.kind];
          if (g.kind === 'frag') {
            blastLight.position.set(g.x, g.y + 0.4, g.z);
            blastLight.intensity = 60;
            events.onFrag(g, fighters);
          } else if (g.kind === 'flash') {
            blastLight.position.set(g.x, g.y + 0.4, g.z);
            blastLight.intensity = 40;
            // Who is blinded: anyone in radius with a line to the blast. Facing
            // it blinds fully; facing away still catches a partial flash up
            // close, because a flashbang is not a polite request.
            const victims = [];
            for (const f of fighters) {
              if (!f.alive || f === g.owner) continue;
              const dx = f.x - g.x;
              const dz = f.z - g.z;
              const dist = Math.hypot(dx, dz);
              if (dist > def.radius) continue;
              const eye = { x: f.x, y: f.y + (f.eye || 1.6), z: f.z };
              const len = Math.hypot(g.x - eye.x, (g.y - eye.y), g.z - eye.z) || 1;
              const wall = rayHitDistance(colliders, eye.x, eye.y, eye.z, (g.x - eye.x) / len, (g.y - eye.y) / len, (g.z - eye.z) / len, len);
              if (wall < len - 0.05 && dist > 8) continue;
              const facingX = -Math.sin(f.yaw);
              const facingZ = -Math.cos(f.yaw);
              const dot = (dx * facingX + dz * facingZ) / (dist || 1);
              const facing = dot > 0 ? 1 : 0.45;
              const seconds = Math.max(0.4, def.blindSeconds * (1 - (dist / def.radius) * 0.6) * facing);
              victims.push({ fighter: f, seconds });
            }
            events.onFlash(g, victims);
          } else if (g.kind === 'smoke') {
            const slot = clouds.find((c) => !c.active) ?? clouds[0];
            slot.active = true;
            slot.x = g.x;
            slot.y = Math.max(0.4, g.y);
            slot.z = g.z;
            slot.r = def.radius;
            slot.until = time + def.lifeSeconds;
            const offsets = [[0, 0.8, 0], [1.6, 0.6, 0.8], [-1.4, 0.7, -0.9], [0.7, 1.1, -1.5], [-0.8, 0.5, 1.4]];
            slot.puffs.forEach((puff, j) => {
              puff.visible = true;
              puff.position.set(slot.x + offsets[j][0], slot.y + offsets[j][1], slot.z + offsets[j][2]);
              puff.material.opacity = 0.5;
            });
            events.onSmoke(g);
          }
        }
      }
      for (const c of clouds) {
        if (!c.active) continue;
        if (time >= c.until) {
          c.active = false;
          for (const puff of c.puffs) { puff.visible = false; puff.material.opacity = 0; }
        } else {
          // Thin out as the cloud ages, so a smoke screen has a visible clock.
          const left = Math.max(0, (c.until - time) / GRENADES.smoke.lifeSeconds);
          for (const puff of c.puffs) puff.material.opacity = 0.18 + 0.32 * left;
        }
      }
      if (blastLight.intensity > 0) blastLight.intensity = Math.max(0, blastLight.intensity - dt * 120);
    },
  };
}
