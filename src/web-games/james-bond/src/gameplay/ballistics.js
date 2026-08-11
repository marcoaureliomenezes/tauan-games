// Web game package: james-bond.
//
// Passo balístico PURO de um projétil (granada, foguete). Não conhece THREE,
// não conhece a cena: recebe posição/velocidade em campos {x, y, z} e uma
// SONDA de mundo, e devolve o que aconteceu no passo.
//
// Existe separado de explosives.js por causa de um bug real: a colisão dos
// projéteis era feita contra a CÉLULA do grid (`world.walkable`), um teste 2D
// que ignora altura. Isso produzia três defeitos ao mesmo tempo:
//
//   1. Granada arremessada do mezanino atravessava a laje e caía no térreo —
//      a laje não é célula de parede, então nada a segurava.
//   2. Granada arremessada com a vista livre do segundo andar batia numa
//      "parede invisível": a parede do TÉRREO (3.15 m) bloqueava um projétil
//      voando a 5 m de altura, porque só a célula era consultada.
//   3. Do mezanino era impossível bombardear o térreo pela boca da escada.
//
// A sonda (`probe`) é a física real do jogo — `solidAt` e `surfaceBelow` de
// engine/physics.js — então o projétil colide exatamente contra os volumes que
// o jogador também sente. Sendo puro, o passo é testável sem navegador.

/**
 * @typedef {{ solidAt(x:number, y:number, z:number, radius?:number):boolean,
 *             surfaceBelow(x:number, z:number, fromY:number):number }} WorldProbe
 */

/**
 * Avança um projétil por `dt`.
 *
 * @param {{position:{x,y,z}, velocity:{x,y,z}, radius:number, gravity:number,
 *          restitution:number, friction:number}} projectile
 * @param {number} dt
 * @param {WorldProbe} probe
 * @returns {{ hitSolid:boolean, landed:boolean, from:{x,y,z} }}
 *   `from` é a posição ANTES do passo — é onde um foguete deve detonar quando
 *   bate numa parede, para a explosão nascer do lado de fora dela.
 */
export function stepProjectile(projectile, dt, probe) {
  const { position, velocity } = projectile;
  const radius = projectile.radius ?? 0.14;
  const restitution = projectile.restitution ?? 0.48;
  const friction = projectile.friction ?? 0.82;
  const from = { x: position.x, y: position.y, z: position.z };

  velocity.y -= (projectile.gravity ?? 12) * dt;
  position.x += velocity.x * dt;
  position.y += velocity.y * dt;
  position.z += velocity.z * dt;

  // --- Apoio: a superfície mais alta ABAIXO de onde o projétil estava --------
  // Referência é a altura ANTERIOR: assim uma granada que cai sobre o mezanino
  // pousa nele, e uma que sobe por baixo dele não "gruda" no piso de cima.
  let landed = false;
  const support = probe.surfaceBelow(position.x, position.z, from.y + radius);
  if (velocity.y <= 0 && position.y - radius <= support) {
    position.y = support + radius;
    velocity.y *= -restitution;
    velocity.x *= friction;
    velocity.z *= friction;
    landed = true;
  }

  // --- Sólido: parede, laje, teto — sempre com a altura real ----------------
  let hitSolid = false;
  if (probe.solidAt(position.x, position.y, position.z, radius)) {
    hitSolid = true;
    // Resolve eixo a eixo: quicar só na normal atingida mantém a granada
    // rolando ao longo da parede em vez de voltar pela mesma linha.
    if (!probe.solidAt(from.x, position.y, position.z, radius)) {
      position.x = from.x;
      velocity.x *= -restitution;
    }
    if (!probe.solidAt(position.x, position.y, from.z, radius)) {
      position.z = from.z;
      velocity.z *= -restitution;
    }
    if (probe.solidAt(position.x, position.y, position.z, radius)) {
      // Canto (ou teto): volta inteiro para o ponto anterior, que era livre.
      position.x = from.x;
      position.y = from.y;
      position.z = from.z;
      velocity.x *= -restitution;
      velocity.y *= -restitution;
      velocity.z *= -restitution;
    }
  }

  return { hitSolid, landed, from };
}
