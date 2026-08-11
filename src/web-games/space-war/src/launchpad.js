// launchpad.js — PLATAFORMA DE LANÇAMENTO na superfície da Terra (port
// simplificado do launch_site.gd do space-war Godot): deck octogonal, torre
// umbilical com braços, 4 refletores e luzes de baliza. A plataforma gira COM
// o planeta (recolocada por frame a partir do vetor "up" do ponto de pouso) e
// some com fade quando a nave ganha altitude.

import * as THREE from '../../vendor/three.module.min.js';
import { scene } from './scene.js';

let pad = null;
const _q = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

export function buildLaunchPad() {
  pad = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b93a1, roughness: 0.6, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3c4350, roughness: 0.8, metalness: 0.3 });
  const warn = new THREE.MeshStandardMaterial({ color: 0xd8b13c, roughness: 0.7 });

  // deck octogonal + base
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 0.7, 8), steel);
  deck.position.y = -0.35;
  pad.add(deck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.4, 1.6, 8), dark);
  base.position.y = -1.5;
  pad.add(base);
  // anel de aviso (borda pintada)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.18, 6, 24), warn);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  pad.add(ring);

  // torre umbilical + braços
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 12, 1.2), steel);
  tower.position.set(4.6, 6, 0);
  pad.add(tower);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.5), dark);
    arm.position.set(3.2, 3.2 + i * 3.1, 0);
    pad.add(arm);
  }

  // 4 refletores nos cantos (postes + luz emissiva)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffe9a8, emissiveIntensity: 1.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 6), dark);
    post.position.set(Math.cos(a) * 6.2, 2.1, Math.sin(a) * 6.2);
    pad.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
    lamp.position.set(Math.cos(a) * 6.2, 4.3, Math.sin(a) * 6.2);
    pad.add(lamp);
  }

  pad.visible = false;
  scene.add(pad);
  return pad;
}

// Recoloca a plataforma sob a nave pousada: `up` é o radial do ponto de pouso
// (gira com o spin do planeta); some com fade acima de 26 u de altitude.
export function updateLaunchPad(body, up, shipAltitude) {
  if (!pad || !body) return;
  const fade = 1 - Math.max(0, Math.min(1, (shipAltitude - 14) / 12));
  pad.visible = fade > 0.02;
  if (!pad.visible) return;
  pad.position.copy(body.worldPos).addScaledVector(up, body.def.radius + 0.35);
  _q.setFromUnitVectors(_yAxis, up);
  pad.quaternion.copy(_q);
}
