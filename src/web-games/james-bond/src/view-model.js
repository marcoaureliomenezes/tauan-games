import * as THREE from '../../vendor/three.module.min.js';
import { WEAPONS } from './content/weapons.js';
import { buildWeaponModel } from './content/weapon-models.js';

const HIP_POS = new THREE.Vector3(0.26, -0.27, -0.52);
const ADS_POS = new THREE.Vector3(0, -0.152, -0.42);
const muzzleLocal = new THREE.Vector3();
const temp = new THREE.Vector3();

// First-person weapon rig: bob, look-sway, recoil kick, reload dip, sprint tilt, ADS pose,
// plus an additive muzzle-flash card at the barrel tip.
export function createViewModel(camera) {
  const rig = new THREE.Group();
  rig.scale.setScalar(0.85);
  camera.add(rig);
  const flash = new THREE.Mesh(flashGeometry(), makeFlashMaterial());
  flash.visible = false;
  let weaponId = null;
  let model = null;
  let kick = 0;
  let flashLife = 0;
  let swayX = 0;
  let swayY = 0;
  let bobPhase = 0;

  function setWeapon(id) {
    if (id === weaponId) return;
    weaponId = id;
    if (model) {
      model.remove(flash);
      model.traverse((part) => part.geometry?.dispose());
      rig.remove(model);
    }
    model = buildWeaponModel(id);
    model.traverse((part) => part.layers.set(1));
    rig.add(model);
    model.add(flash);
    flash.layers.set(1);
    const muzzle = WEAPONS[id].muzzle;
    flash.position.set(muzzle[0], muzzle[1], muzzle[2] - 0.06);
  }

  function onShoot() {
    const weapon = WEAPONS[weaponId];
    kick = weapon.kick;
    if (!weapon.suppressed) {
      flashLife = 0.05;
      flash.visible = true;
      flash.rotation.z = Math.random() * Math.PI * 2;
      const scale = 0.7 + Math.random() * 0.5;
      flash.scale.set(scale, scale, scale);
    }
  }

  // state: { time, dt, moving, sprinting, adsT, lookX, lookY, reloadT (0..1 or -1) }
  function update(state) {
    if (!model) return;
    const { dt, time, moving, sprinting, adsT, lookX, lookY, reloadT } = state;
    kick = Math.max(0, kick - dt * 0.55);
    swayX += (THREE.MathUtils.clamp(-lookX * 0.0011, -0.05, 0.05) - swayX) * Math.min(1, dt * 9);
    swayY += (THREE.MathUtils.clamp(lookY * 0.0009, -0.04, 0.04) - swayY) * Math.min(1, dt * 9);
    if (moving) bobPhase += dt * (sprinting ? 11.5 : 8);
    const bobScale = (1 - adsT * 0.75) * (sprinting ? 1.5 : 1);
    const bobY = moving ? Math.sin(bobPhase * 2) * 0.0075 * bobScale : 0;
    const bobX = moving ? Math.cos(bobPhase) * 0.005 * bobScale : 0;

    rig.position.lerpVectors(HIP_POS, ADS_POS, adsT);
    rig.position.x += bobX + swayX * 0.35;
    rig.position.y += bobY + swayY * 0.3;
    rig.position.z += kick * 0.9;

    rig.rotation.set(kick * 0.55 + swayY * 0.7, swayX * 0.9, 0);
    if (sprinting && !adsT) {
      rig.rotation.x += 0.22;
      rig.rotation.y += 0.3;
      rig.position.y -= 0.04;
    }
    if (reloadT >= 0) {
      const dip = Math.sin(reloadT * Math.PI);
      rig.position.y -= dip * 0.16;
      rig.rotation.x += dip * 0.35;
      rig.rotation.z += dip * 0.3;
    }
    if (flashLife > 0) {
      flashLife -= dt;
      flash.material.opacity = Math.max(0, flashLife / 0.05) * 0.95;
      if (flashLife <= 0) flash.visible = false;
    }
    // subtle idle breathing
    rig.position.y += Math.sin(time * 1.7) * 0.0012;
    rig.rotation.z += Math.sin(time * 1.1) * 0.002;
  }

  function muzzleWorld(target) {
    const muzzle = WEAPONS[weaponId]?.muzzle;
    if (!model || !muzzle) return target.copy(rig.getWorldPosition(temp));
    muzzleLocal.set(muzzle[0], muzzle[1], muzzle[2]);
    return model.localToWorld(target.copy(muzzleLocal));
  }

  function dispose() {
    model?.traverse((part) => part.geometry?.dispose());
    flash.geometry.dispose();
    flash.material.map.dispose();
    flash.material.dispose();
    camera.remove(rig);
  }

  setWeapon('p7');
  return { rig, setWeapon, onShoot, update, muzzleWorld, dispose, get weaponId() { return weaponId; } };
}

function flashGeometry() {
  return new THREE.PlaneGeometry(0.42, 0.42);
}

export function makeFlashMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(64, 64, 2, 64, 64, 60);
  glow.addColorStop(0, 'rgba(255,244,205,1)');
  glow.addColorStop(0.35, 'rgba(255,196,110,.85)');
  glow.addColorStop(1, 'rgba(255,140,40,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  context.globalCompositeOperation = 'lighter';
  for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    context.save();
    context.translate(64, 64);
    context.rotate(angle);
    const spike = context.createLinearGradient(-62, 0, 62, 0);
    spike.addColorStop(0, 'rgba(255,160,60,0)');
    spike.addColorStop(0.5, 'rgba(255,230,170,.9)');
    spike.addColorStop(1, 'rgba(255,160,60,0)');
    context.fillStyle = spike;
    context.fillRect(-62, angle < 1 ? -3 : -1.5, 124, angle < 1 ? 6 : 3);
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
