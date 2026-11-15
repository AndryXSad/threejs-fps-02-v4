// The viewmodel: the gun the player sees, built from boxes like everything
// else in this game, one model per weapon so a Maul looks nothing like a
// Longshot. It bobs with the walk cycle, sways when the mouse turns, kicks
// back on every shot and slides to the centre of the screen when the player
// aims down sights. It is attached to the camera, so it never clips the world.
// When the player crouches, the gun rides lower with the eye — the viewmodel
// reads the camera, so no special case is needed here.
import * as THREE from 'three';
import { WEAPONS } from './config.js';

const HIP_POS = new THREE.Vector3(0.26, -0.23, -0.5);
const ADS_POS = new THREE.Vector3(0, -0.148, -0.38);

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6 }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

// One box-built gun per weapon id. The barrel points down -z (away from the
// camera); the muzzle offset is where the flash and the tracer start.
function buildModel(id) {
  const group = new THREE.Group();
  const accent = {
    p9: 0xd9822b, rasp: 0xc2a23a, longshot: 0xff7a1a, maul: 0x8c4a2f, lance: 0x2ec4b6,
  }[id];
  const steel = 0x2b2b2e;
  const dark = 0x17171a;
  // Receiver, grip, stock, magazine: every gun has these.
  group.add(box(0.07, 0.11, 0.34, steel, 0, 0, 0));
  group.add(box(0.05, 0.13, 0.06, dark, 0, -0.11, 0.1));
  group.add(box(0.06, 0.09, 0.16, dark, 0, -0.01, 0.24));
  group.add(box(0.05, 0.12, 0.07, dark, 0, -0.1, -0.02));
  let muzzleZ = -0.42;
  if (id === 'p9') {
    // A sidearm: short, no stock, a stub barrel.
    group.add(box(0.045, 0.045, 0.14, steel, 0, 0.02, -0.22));
    muzzleZ = -0.3;
  } else if (id === 'rasp') {
    // An SMG: compact barrel, a long magazine, a stub stock.
    group.add(box(0.05, 0.05, 0.22, steel, 0, 0.02, -0.26));
    group.add(box(0.06, 0.16, 0.09, accent, 0, -0.12, -0.06));
    muzzleZ = -0.38;
  } else if (id === 'longshot') {
    group.add(box(0.045, 0.045, 0.34, steel, 0, 0.02, -0.32));
    group.add(box(0.03, 0.06, 0.1, accent, 0, 0.06, -0.12));
    muzzleZ = -0.5;
  } else if (id === 'maul') {
    // A double barrel, wide and short, with a pump grip.
    group.add(box(0.09, 0.07, 0.26, steel, 0, 0.02, -0.28));
    group.add(box(0.06, 0.05, 0.14, dark, 0, -0.04, -0.2));
    group.add(box(0.05, 0.05, 0.08, accent, 0, 0.06, -0.1));
    muzzleZ = -0.42;
  } else if (id === 'lance') {
    group.add(box(0.035, 0.035, 0.55, steel, 0, 0.02, -0.42));
    group.add(box(0.05, 0.05, 0.14, dark, 0, 0.07, -0.05));
    group.add(box(0.02, 0.03, 0.3, accent, 0, 0.055, -0.3));
    muzzleZ = -0.7;
  }
  // The muzzle tip, so the flash can sit exactly on the barrel.
  const tip = new THREE.Object3D();
  tip.position.set(0, 0.02, muzzleZ);
  group.add(tip);
  group.userData.muzzle = tip;
  group.userData.muzzleZ = muzzleZ;
  return group;
}

export function createViewmodel(camera) {
  const group = new THREE.Group();
  camera.add(group);
  const models = {};
  for (const id of Object.keys(WEAPONS)) {
    const model = buildModel(id);
    model.visible = false;
    group.add(model);
    models[id] = model;
  }
  let current = null;
  let bobPhase = 0;
  let recoil = 0;
  let adsT = 0;
  let swayX = 0;
  let swayY = 0;
  const pos = HIP_POS.clone();
  const muzzleWorld = new THREE.Vector3();

  return {
    setWeapon(id) {
      if (current) current.visible = false;
      current = models[id];
      if (current) current.visible = true;
    },
    kick(amount) {
      recoil = Math.min(1, recoil + amount);
    },
    // `moveSpeed` is the player's horizontal speed in m/s; `lookDx/lookDy`
    // are the mouse deltas this frame; `aiming` is whether ADS is held.
    step(dt, moveSpeed, lookDx, lookDy, aiming) {
      bobPhase += dt * (4 + moveSpeed * 1.6);
      const bobAmt = Math.min(1, moveSpeed / 4) * 0.014;
      swayX += (-lookDx * 0.02 - swayX) * Math.min(1, dt * 10);
      swayY += (lookDy * 0.02 - swayY) * Math.min(1, dt * 10);
      recoil = Math.max(0, recoil - dt * 6);
      adsT += ((aiming ? 1 : 0) - adsT) * Math.min(1, dt * 12);
      pos.lerpVectors(HIP_POS, ADS_POS, adsT);
      group.position.set(
        pos.x + Math.sin(bobPhase) * bobAmt + swayX,
        pos.y + Math.abs(Math.cos(bobPhase)) * bobAmt * 0.7 + swayY - recoil * 0.03,
        pos.z + recoil * 0.07,
      );
      group.rotation.x = recoil * 0.12 + swayY * 0.6;
      group.rotation.y = swayX * 0.8;
      group.rotation.z = Math.sin(bobPhase) * bobAmt * 0.4;
    },
    muzzleWorld() {
      if (!current) return muzzleWorld.set(0, 0, 0);
      current.userData.muzzle.getWorldPosition(muzzleWorld);
      return muzzleWorld;
    },
  };
}
