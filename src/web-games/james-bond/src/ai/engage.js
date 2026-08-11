import * as THREE from '../../../vendor/three.module.min.js';
import { CONFIG } from '../config.js';

const muzzleWorld = new THREE.Vector3();
const aimPoint = new THREE.Vector3();
const shotDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

/**
 * O tiro inimigo é um RAIO de verdade contra a geometria do mapa.
 *
 * Antes ele não era: calculava-se a chance de acerto e, dando certo, o dano era
 * aplicado direto no jogador, com um tracer desenhado da boca do cano até ele.
 * Nada consultava a parede que estivesse no meio — daí "tiro atravessando
 * parede": o traçante cruzava a fachada e o dano chegava mesmo com o jogador
 * abrigado. Agora o projétil para no primeiro sólido do caminho, marca ali, e
 * quem está atrás de parede, carro ou barricada não leva o tiro.
 */
function blockedAt(world, from, to) {
  if (!world?.group) return null;
  shotDirection.copy(to).sub(from);
  const range = shotDirection.length();
  if (range < 0.01) return null;
  raycaster.set(from, shotDirection.divideScalar(range));
  raycaster.far = range;
  const hit = raycaster.intersectObject(world.group, true)
    .find((entry) => !entry.object.userData.noRay && !entry.object.userData.fx && entry.distance > 0.2);
  return hit || null;
}

// Rajada com tempo de reação (atiradores humanos): atraso antes do primeiro tiro,
// rajadas curtas, pausas entre elas. Chance real de acerto cai com distância e movimento.
export function fireWeapon(enemy, distance, playerPosition, now, ctx) {
  const { difficulty, game, audio, fx, damagePlayer } = ctx;
  if (enemy.burstLeft <= 0) {
    enemy.burstLeft = difficulty.burst[0] + Math.floor(Math.random() * (difficulty.burst[1] - difficulty.burst[0] + 1));
  }
  enemy.burstLeft -= 1;
  enemy.fireCooldown = enemy.burstLeft > 0
    ? 0.1 + Math.random() * 0.05
    : difficulty.burstGap + Math.random() * 0.5;
  enemy.revealedUntil = now + 4;
  enemy.flashT = 0.05;
  audio.enemyGun(enemy.root.position);
  if (enemy.flash) enemy.flash.rotation.z = Math.random() * Math.PI;
  // Inimigo sem cano modelado (rig de GLB) atira da altura do peito.
  if (enemy.muzzleTip) enemy.muzzleTip.getWorldPosition(muzzleWorld);
  else muzzleWorld.copy(enemy.root.position).setY(enemy.root.position.y + enemy.stats.height * 0.7);
  const speed = game.player.speed || 0;
  const moveFactor = speed > 5.5 ? 0.6 : speed > 0.5 ? 0.82 : 1;
  const crouchFactor = game.player.crouched ? 1.1 : 1;
  const distanceFactor = THREE.MathUtils.clamp(1.2 - distance / CONFIG.enemyFireRange, 0.22, 1);
  const hitChance = difficulty.accuracy * distanceFactor * moveFactor * crouchFactor;
  aimPoint.copy(playerPosition);
  const onTarget = Math.random() < hitChance;
  if (onTarget) {
    aimPoint.y -= 0.12 + Math.random() * 0.15;
  } else {
    // tiro raspando: passa perto e vai bater no cenário
    aimPoint.x += (Math.random() - 0.5) * 2.4;
    aimPoint.y += (Math.random() - 0.3) * 1.6;
    aimPoint.z += (Math.random() - 0.5) * 2.4;
  }

  // O projétil para no primeiro sólido entre o cano e o alvo. Se houver parede,
  // carro ou barricada no caminho, é a parede que leva o tiro — não o jogador.
  const blocked = blockedAt(game.world, muzzleWorld, aimPoint);
  if (blocked) {
    fx.tracer(muzzleWorld, blocked.point, 0xffb27a);
    fx.impact(blocked.point, 0xcbb998);
    audio.impact(blocked.point, false);
    return;
  }

  fx.tracer(muzzleWorld, aimPoint, 0xffb27a);
  if (onTarget) {
    damagePlayer(difficulty.damage);
    return;
  }
  fx.impact(aimPoint, 0xcbb998);
  audio.crack(aimPoint);
}

// Bote corpo a corpo (vampiros/monstros): investida com dano e tremor de tela.
export function meleeAttack(enemy, ctx) {
  const { audio, fx, damagePlayer } = ctx;
  enemy.fireCooldown = 1.15;
  enemy.attackT = 0.28;
  audio.melee(enemy.root.position);
  fx.rumble(0.1);
  damagePlayer(enemy.meleeDamage);
}
