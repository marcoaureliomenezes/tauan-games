// maps/inhauma-road-guardrails.js — Guardrails instanciados da classe highway
// (aero-fighters-inhauma-visual-uplift-v1, T-V-16; auditoria §2.6 — MG-238 pista
// dupla + BR-040 OSM). Separado de inhauma-road-props.js pelo teto de 250 linhas.
//
// Exporta buildGuardrails(roads, heightAt, material) → [postMesh, railMesh] | null
// (2 InstancedMesh = 2 draw calls para TODOS os guardrails do mapa) e as constantes
// de geometria usadas também na contagem de diagnóstico (inhauma-road-props.js).
// Sem side-effects no load.

import * as THREE from '../../../vendor/three.module.min.js';
import { routeLength, samplePolyline } from './inhauma-road-utils.js';

// Borda externa das pistas na pista dupla (canteiro/2 + pista = 2 + 7,5 = 9,5 m do
// eixo). ESPELHO de DUAL_CARRIAGEWAY em inhauma-road-render.js — mudou lá, muda aqui.
const DUAL_CARRIAGEWAY_OUTER_M = 9.5;
const GUARDRAIL_OFFSET_M = 0.6;   // guardrail logo fora da borda externa da pista
const GUARDRAIL_POST_SPACING_M = 12;

export { GUARDRAIL_POST_SPACING_M };

/** Postes + longarinas contínuas (caixas sobrepostas no passo dos postes) nas bordas
 *  EXTERNAS de toda estrada da classe highway. Retorna null se não há highways. */
export function buildGuardrails(roads, heightAt, material) {
  const posts = [];
  for (const road of roads) {
    if (road.kind !== 'highway') continue;
    const total = routeLength(road.points);
    const outer = (road.dual ? DUAL_CARRIAGEWAY_OUTER_M : road.width * 0.5) + GUARDRAIL_OFFSET_M;
    for (let d = 6; d < total - 6; d += GUARDRAIL_POST_SPACING_M) {
      const p = samplePolyline(road.points, d, total);
      for (const side of [-1, 1]) {
        posts.push({
          x: p.x + Math.cos(p.ang) * side * outer,
          z: p.z - Math.sin(p.ang) * side * outer,
          ang: p.ang,
        });
      }
    }
  }
  if (!posts.length) return null;
  const dummy = new THREE.Object3D();
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), material(0xd8d4bd), posts.length);
  const railMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 0.42, GUARDRAIL_POST_SPACING_M + 0.6),
    material(0xb9bcbd),
    posts.length,
  );
  posts.forEach((p, i) => {
    const y = heightAt(p.x, p.z);
    dummy.position.set(p.x, y + 0.4, p.z);
    dummy.rotation.set(0, p.ang, 0);
    dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, y + 0.72, p.z);
    dummy.updateMatrix();
    railMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.frustumCulled = false;
  railMesh.frustumCulled = false;
  return [postMesh, railMesh];
}
