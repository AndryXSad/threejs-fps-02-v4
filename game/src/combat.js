// Combat: one weapon per fighter, shared by the player and the bots. A shot is
// a ray against the world's boxes and every fighter's body/head boxes, so a
// headshot is a real hit on a real box and cover is real cover. NIGHTSHIFT
// keeps SLAGLINE's damage falloff with range, wall penetration for the
// Longshot and the Lance through thin cover, and pellet spread for the Maul
// shotgun — and adds one thing: the hitboxes follow the fighter's height, so
// a crouched fighter is a smaller target from the head down. Tracers and
// impact bursts are pooled: no new objects in the hot loop.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { rayHitDistance, rayHitBox } from './map.js';

const TRACER_POOL = 24;
const BURST_POOL = 10;

export function createCombatFx(scene) {
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const bursts = [];
  for (let i = 0; i < BURST_POOL; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
    const mat = new THREE.PointsMaterial({ color: 0xffb347, size: 0.09, transparent: true, opacity: 0 });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    bursts.push({ points, life: 0, vel: new Float32Array(30) });
  }
  const flash = new THREE.PointLight(0xffb347, 0, 9, 2);
  scene.add(flash);
  // Muzzle flash: a small glowing quad at the barrel that lives one frame.
  const muzzle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  muzzle.frustumCulled = false;
  scene.add(muzzle);
  let tracerIdx = 0;
  let burstIdx = 0;

  return {
    tracer(from, to, color) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % TRACER_POOL;
      const pos = t.line.geometry.attributes.position.array;
      pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
      pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.material.color.setHex(color);
      t.line.material.opacity = 0.9;
      t.life = 0.07;
    },
    burst(point, color, count = 8) {
      const b = bursts[burstIdx];
      burstIdx = (burstIdx + 1) % BURST_POOL;
      const pos = b.points.geometry.attributes.position.array;
      for (let i = 0; i < 10; i += 1) {
        const k = i * 3;
        pos[k] = point.x; pos[k + 1] = point.y; pos[k + 2] = point.z;
        b.vel[k] = (Math.random() * 2 - 1) * 2.2;
        b.vel[k + 1] = Math.random() * 2.4 + 0.6;
        b.vel[k + 2] = (Math.random() * 2 - 1) * 2.2;
      }
      b.points.material.color.setHex(color);
      b.points.material.opacity = 1;
      b.life = 0.5;
      void count;
    },
    muzzleAt(point, camera) {
      muzzle.position.set(point.x, point.y, point.z);
      muzzle.lookAt(camera.position);
      muzzle.material.opacity = 0.95;
    },
    flashAt(point, intensity) {
      flash.position.set(point.x, point.y, point.z);
      flash.intensity = intensity;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life > 0) {
          t.life -= dt;
          t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        }
      }
      for (const b of bursts) {
        if (b.life > 0) {
          b.life -= dt;
          const pos = b.points.geometry.attributes.position.array;
          for (let i = 0; i < 10; i += 1) {
            const k = i * 3;
            pos[k] += b.vel[k] * dt;
            pos[k + 1] += b.vel[k + 1] * dt;
            pos[k + 2] += b.vel[k + 2] * dt;
            b.vel[k + 1] -= 9 * dt;
          }
          b.points.geometry.attributes.position.needsUpdate = true;
          b.points.material.opacity = Math.max(0, b.life / 0.5);
        }
      }
      if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 60);
      if (muzzle.material.opacity > 0) muzzle.material.opacity = 0;
    },
  };
}

// Ray vs one fighter's boxes. Returns { dist, part } or null. The boxes scale
// with the fighter's height: a standing fighter is 1.72 m (head 1.32–1.74,
// body 0–1.32, as before), a crouched one is 1.15 m and every box shrinks
// with it — crouching behind a crate is real cover, not a pose.
export function rayFighter(ox, oy, oz, dx, dy, dz, fighter, maxDist) {
  const { x, y, z } = fighter;
  const h = fighter.height ?? 1.72;
  const headMin = y + h * 0.767;
  const headMax = y + h * 1.012;
  const head = rayAABB(ox, oy, oz, dx, dy, dz, x - 0.22, headMin, z - 0.22, x + 0.22, headMax, z + 0.22, maxDist);
  const body = rayAABB(ox, oy, oz, dx, dy, dz, x - 0.36, y, z - 0.36, x + 0.36, headMin, z + 0.36, maxDist);
  if (head !== Infinity && head <= body) return { dist: head, part: 'head' };
  if (body !== Infinity) return { dist: body, part: 'body' };
  return null;
}

function rayAABB(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const mins = [minX, minY, minZ];
  const maxs = [maxX, maxY, maxZ];
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

// Damage falloff: full damage inside the near range, then a straight line down
// to the far fraction at the weapon's max range. A rifle still hurts far away;
// a shotgun does not.
export function falloffFactor(def, dist) {
  const [near, farFrac] = def.falloff;
  if (dist <= near) return 1;
  const t = Math.min(1, (dist - near) / Math.max(1, def.range - near));
  return 1 - (1 - farFrac) * t;
}

// A fighter's weapon: magazine, reserve, cooldown, reload and bloom. One instance
// per fighter; the player and the bots drive the same code.
export function createWeaponState(weaponId) {
  const def = WEAPONS[weaponId];
  return {
    id: weaponId,
    def,
    mag: def.mag,
    reserve: def.reserve,
    cooldown: 0,
    reloadT: 0,
    bloom: 0,
  };
}

export function weaponStep(w, dt) {
  if (w.cooldown > 0) w.cooldown -= dt;
  if (w.reloadT > 0) {
    w.reloadT -= dt;
    if (w.reloadT <= 0) {
      const need = w.def.mag - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take;
      w.reserve -= take;
    }
  }
  w.bloom = Math.max(0, w.bloom - dt * 0.045);
}

export function weaponReady(w) {
  return w.cooldown <= 0 && w.reloadT <= 0 && w.mag > 0;
}

export function weaponReload(w) {
  if (w.reloadT > 0 || w.mag >= w.def.mag || w.reserve <= 0) return false;
  w.reloadT = 1.6;
  return true;
}

// Fire one trigger pull. `fighters` are the possible targets (excluding the
// shooter). Returns { hits: [{ fighter, part, dmg }], point, blocked, dir,
// penetrated } — or null when the weapon is not ready. A pellet gun fires one
// ray per pellet; a wall stops a bullet unless the weapon penetrates thin
// cover, in which case the ray continues from the wall's far side at reduced
// damage. `dmg` already carries falloff and penetration; the caller only adds
// the headshot multiplier.
export function fireRound(w, origin, dir, spread, random, colliders, fighters, maxDist) {
  if (!weaponReady(w)) return null;
  w.mag -= 1;
  w.cooldown = w.def.interval;
  w.bloom = Math.min(0.05, w.bloom + (w.id === 'lance' ? 0.02 : w.id === 'maul' ? 0.03 : 0.008));
  const hits = [];
  let point = null;
  let blocked = false;
  let penetrated = false;
  let outDir = dir;
  for (let p = 0; p < w.def.pellets; p += 1) {
    const dx = dir.x + (random() * 2 - 1) * spread;
    const dy = dir.y + (random() * 2 - 1) * spread;
    const dz = dir.z + (random() * 2 - 1) * spread;
    const len = Math.hypot(dx, dy, dz) || 1;
    const nd = { x: dx / len, y: dy / len, z: dz / len };
    outDir = nd;
    const shot = castRay(origin, nd, colliders, fighters, maxDist, w.def);
    if (shot) {
      if (shot.hit) hits.push(shot.hit);
      if (shot.penetrated) penetrated = true;
      point = shot.point;
      blocked = shot.blocked;
    }
  }
  return { hits, point, blocked, dir: outDir, penetrated };
}

// One ray, with at most one wall penetration. The caller owns the pellet loop.
function castRay(origin, dir, colliders, fighters, maxDist, def) {
  const wall = rayHitBox(colliders, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxDist);
  let best = null;
  let bestDist = Math.min(wall.dist, maxDist);
  for (const f of fighters) {
    if (!f.alive) continue;
    const hit = rayFighter(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, f, bestDist);
    if (hit && hit.dist < bestDist) {
      bestDist = hit.dist;
      best = { fighter: f, part: hit.part };
    }
  }
  if (best) {
    const dmg = def.damage * falloffFactor(def, bestDist);
    return {
      hit: { fighter: best.fighter, part: best.part, dmg },
      point: pointAt(origin, dir, bestDist),
      blocked: true,
      penetrated: false,
    };
  }
  // No fighter before the wall: try to punch through thin cover.
  if (wall.box && def.penetration > 0 && wall.dist < maxDist) {
    const thickness = wallThickness(wall.box, origin, dir);
    if (thickness > 0 && thickness < 1.2) {
      const exit = pointAt(origin, dir, wall.dist + thickness + 0.02);
      const rest = maxDist - (wall.dist + thickness);
      if (rest > 1) {
        const after = castRayNoPen(exit, dir, colliders, fighters, rest);
        if (after.hit) {
          const dmg = def.damage * def.penetration * falloffFactor(def, wall.dist + thickness + after.hit.dist);
          return {
            hit: { fighter: after.hit.fighter, part: after.hit.part, dmg },
            point: after.point,
            blocked: true,
            penetrated: true,
          };
        }
      }
    }
  }
  const dist = Math.min(wall.dist, maxDist);
  return {
    hit: null,
    point: pointAt(origin, dir, dist),
    blocked: dist < maxDist,
    penetrated: false,
  };
}

function castRayNoPen(origin, dir, colliders, fighters, maxDist) {
  const wallDist = rayHitDistance(colliders, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxDist);
  let best = null;
  let bestDist = Math.min(wallDist, maxDist);
  for (const f of fighters) {
    if (!f.alive) continue;
    const hit = rayFighter(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, f, bestDist);
    if (hit && hit.dist < bestDist) {
      bestDist = hit.dist;
      best = { fighter: f, part: hit.part, dist: hit.dist };
    }
  }
  return { hit: best, point: pointAt(origin, dir, bestDist) };
}

// How far the ray travels inside the box it entered: the exit distance minus
// the entry distance, along this ray.
function wallThickness(box, origin, dir) {
  let tmin = 0;
  let tmax = Infinity;
  const mins = [box.min.x, box.min.y, box.min.z];
  const maxs = [box.max.x, box.max.y, box.max.z];
  const os = [origin.x, origin.y, origin.z];
  const ds = [dir.x, dir.y, dir.z];
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mins[i] || os[i] > maxs[i]) return 0;
    } else {
      let t1 = (mins[i] - os[i]) / ds[i];
      let t2 = (maxs[i] - os[i]) / ds[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return 0;
    }
  }
  return Math.max(0, tmax - tmin);
}

function pointAt(origin, dir, dist) {
  return { x: origin.x + dir.x * dist, y: origin.y + dir.y * dist, z: origin.z + dir.z * dist };
}

// Damage after armour: armour absorbs half until it is gone.
export function applyDamage(fighter, raw) {
  let left = raw;
  if (fighter.armor > 0) {
    const absorbed = Math.min(fighter.armor, left * 0.5);
    fighter.armor -= absorbed;
    left -= absorbed;
  }
  fighter.hp -= left;
  if (fighter.hp <= 0) {
    fighter.hp = 0;
    fighter.alive = false;
  }
  return left;
}
