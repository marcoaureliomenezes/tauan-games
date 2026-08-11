import * as THREE from '../../../vendor/three.module.min.js';
import { CONFIG } from '../config.js';

const position = new THREE.Vector3();

export function createMissionRules(game, mission, world, input, audio, callbacks) {
  game.objectives = Object.entries(mission.objectives).map(([key, label]) => ({ key, label, done: false }));
  let prompt = null;

  function complete(key) {
    const objective = game.objectives.find((item) => item.key === key);
    if (!objective || objective.done) return false;
    objective.done = true;
    const mesh = world.objectiveMeshes.find((item) => item.userData.key === key);
    if (mesh) {
      mesh.userData.active = false;
      mesh.material.color.set(0x315942);
      mesh.material.emissive.set(0x10251a);
      mesh.children[0]?.material?.color.set(0x284238);
    }
    audio.objective();
    callbacks.objective(objective);
    return true;
  }

  function update() {
    position.copy(game.camera.position);
    prompt = null;
    let nearest;
    let distance = Infinity;
    world.objectiveMeshes.forEach((mesh) => {
      if (!mesh.userData.active) return;
      const value = mesh.position.distanceTo(position);
      if (value < distance) { distance = value; nearest = mesh; }
    });
    if (nearest && distance <= CONFIG.interactRange) {
      prompt = mission.objectives[nearest.userData.key];
      if (input.consume('KeyE')) complete(nearest.userData.key);
    }
    const extractionDistance = world.extraction.distanceTo(position);
    if (extractionDistance < 2.2) {
      if (game.objectives.every((item) => item.done)) callbacks.complete();
      else prompt = 'Objetivos pendentes';
    }
    callbacks.prompt(prompt);
  }

  return { update, complete, get prompt() { return prompt; } };
}
