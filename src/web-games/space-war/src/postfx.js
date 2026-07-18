// postfx.js — Pós-processamento (bloom) via examples/jsm do three r165 (vendorado).
// Reuso de terceiros (2026-07-01): EffectComposer + UnrealBloomPass + OutputPass —
// não reimplementamos bloom. O bloom é o que faz Sol, estrela de nêutrons, disco de
// acreção e lasers BRILHAREM de verdade em vez de parecerem adesivos chapados.
//
// RESOLUÇÃO ADAPTATIVA (fix de lag 2026-07-01): perto de um corpo os shaders FBM
// (estrela/disco/remanescente) dominam o custo POR FRAGMENTO — a única alavanca
// honesta em GPU integrada é renderizar menos fragmentos. Medimos a média móvel do
// frame-time e degrauamos o pixel-ratio (1.0×…0.55× do teto) para manter fluidez;
// quando sobra fôlego, sobe de volta. O bloom (que é um borrão) roda a MEIA resolução.
//
// Headless/CI: composer desligado (renderer.render direto) — swiftshader estável.

import * as THREE from '../../vendor/three.module.min.js';
import { EffectComposer } from '../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../../vendor/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/jsm/postprocessing/OutputPass.js';

const HEADLESS = typeof navigator !== 'undefined' && navigator.webdriver === true;

// ── LENTE GRAVITACIONAL (2026-07-02): distorção de tela ao redor do buraco
// negro — referência visual: imagens EHT de M87*/Sgr A* e o clássico anel de
// Einstein (o fundo é "empurrado" para fora do raio de Einstein e forma arcos).
// Aproximação de tela barata e estável: uv' = bh + d·(1 − θ²/|d|²), 1 passe.
const LENS_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uBH: { value: new THREE.Vector2(0.5, 0.5) },
    uShip: { value: new THREE.Vector2(0.5, 0.5) },   // proteção: não lentear a NAVE
    uTheta: { value: 0.0 },      // raio de Einstein em fração de tela (0 = off)
    uAspect: { value: 1.0 },
    uMix: { value: 0.0 },
    uShadow: { value: 1.0 },     // 1 = buraco negro (sombra); 0 = estrela de nêutrons
    uJBeta: { value: 0.0 },      // β da viagem interestelar → aberração/Doppler de tela
    uTrans: { value: 0.0 },      // pulso de transição de modo (zoom radial + brilho)
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uBH;
    uniform vec2 uShip;
    uniform float uTheta;
    uniform float uAspect;
    uniform float uMix;
    uniform float uShadow;
    uniform float uJBeta;
    uniform float uTrans;
    varying vec2 vUv;
    // SANITIZAÇÃO PRÉ-BLOOM (AC-06): este é o último passe antes do bloom — um
    // único NaN/Inf aqui vira mancha branca espalhada por TODOS os mips (gotcha
    // aditivo+log-depth). NaN → 0; clamp [0, 64] mata Inf/overbright.
    vec4 sanitize(vec4 c) {
      if (c.r != c.r || c.g != c.g || c.b != c.b) c.rgb = vec3(0.0);
      return vec4(min(max(c.rgb, vec3(0.0)), vec3(64.0)), c.a);
    }
    // amostra o fundo lenseado com uma força de deflexão dada; fora da tela → base
    vec4 sampleLensed(vec4 base, vec2 d, float pull, float swirl) {
      vec2 d2 = d * (1.0 - pull);
      // REDEMOINHO (frame dragging visual dos prints): rotação tangencial que
      // decai com a distância — as estrias do fundo enrolam ao redor da sombra.
      float cs = cos(swirl), sn = sin(swirl);
      d2 = vec2(d2.x * cs - d2.y * sn, d2.x * sn + d2.y * cs);
      vec2 uv2 = uBH + vec2(d2.x / uAspect, d2.y);
      if (uv2.x < 0.0 || uv2.x > 1.0 || uv2.y < 0.0 || uv2.y > 1.0) return base;
      return texture2D(tDiffuse, uv2);
    }
    void main() {
      // RELATIVIDADE DE TELA (viagem interestelar, AC-04): o skybox/fundo
      // converge suavemente p/ frente (aberração — o nariz cola na direção do
      // voo, então o centro da tela É a direção do movimento) + Doppler:
      // azul à frente, vermelho na periferia. Realista e leve (sem warp-tunnel).
      vec2 uvW = vUv;
      vec3 jTint = vec3(1.0);
      if (uJBeta > 0.001) {
        vec2 dc = vUv - vec2(0.5);
        dc.x *= uAspect;
        float rj = length(dc);
        uvW = mix(vUv, vec2(0.5), uJBeta * 0.20 * (1.0 - smoothstep(0.0, 0.75, rj)));
        float blue = uJBeta * (1.0 - smoothstep(0.0, 0.5, rj));
        float red  = uJBeta * smoothstep(0.35, 0.9, rj) * 0.55;
        jTint = vec3(1.0 - 0.20 * blue + 0.16 * red,
                     1.0 - 0.05 * blue - 0.05 * red,
                     1.0 + 0.28 * blue - 0.20 * red);
      }
      // TRANSIÇÃO DE MODO (acoplar/desacoplar sistema planetário, engatar
      // jornada): zoom radial sutil p/ o centro + levante de brilho — a troca
      // de estado LÊ na tela sem teleporte nem corte seco.
      if (uTrans > 0.001) {
        vec2 dt2 = vUv - vec2(0.5);
        uvW = mix(uvW, vec2(0.5), uTrans * 0.12 * smoothstep(0.0, 0.7, length(dt2)));
        jTint *= vec3(1.0 + 0.22 * uTrans);
      }
      vec4 base = sanitize(texture2D(tDiffuse, uvW));
      base.rgb *= jTint;
      if (uMix <= 0.001 || uTheta <= 0.0005) { gl_FragColor = sanitize(base); return; }
      // a lente é de TELA (sem profundidade): protege a região da NAVE — objeto
      // em primeiro plano não pode ser esticado pela lente do fundo.
      vec2 ds = vUv - uShip;
      ds.x *= uAspect;
      float protectShip = smoothstep(0.045, 0.15, length(ds));
      float mixEff = uMix * protectShip;
      if (mixEff <= 0.001) { gl_FragColor = sanitize(base); return; }
      vec2 d = vUv - uBH;
      d.x *= uAspect;                       // círculo de verdade na tela
      float r = max(length(d), 1e-5);
      // núcleo SUAVIZADO (sem singularidade): deflexão máxima limitada e contínua
      // — dentro do raio de Einstein a imagem inverte (física), sem espelhamento
      // explosivo que borrava retângulos da borda da tela.
      float pull = (uTheta * uTheta) / (r * r + 0.25 * uTheta * uTheta);
      float swirl = 0.9 * (uTheta * uTheta) / (r * r + 0.6 * uTheta * uTheta);
      // ABERRAÇÃO CROMÁTICA sutil no raio de Einstein: a luz azul deflete um
      // pouco mais que a vermelha (prisma gravitacional) — os arcos ganham
      // franjas de cor como nos prints (3 taps, só na região da lente).
      vec4 lensed = sampleLensed(base, d, pull, swirl);
      float lensedR = sampleLensed(base, d, pull * 0.96, swirl * 0.97).r;
      float lensedB = sampleLensed(base, d, pull * 1.04, swirl * 1.03).b;
      lensed.r = mix(lensed.r, lensedR, 0.8);
      lensed.b = mix(lensed.b, lensedB, 0.8);
      // escurece o miolo (sombra) e realça um ARO fino no raio de Einstein —
      // SÓ para buraco negro: estrela de nêutrons tem SUPERFÍCIE, não sombra
      // ("mesmo não sendo um buraco negro… ela curva o espaço" — sem miolo preto).
      float shadow = smoothstep(uTheta * 0.62, uTheta * 0.30, r) * uShadow;
      float ring = smoothstep(uTheta * 0.20, 0.0, abs(r - uTheta)) * (0.2 + 0.3 * uShadow);
      vec4 c = mix(base, lensed, mixEff);
      c.rgb = c.rgb * (1.0 - shadow * mixEff) + vec3(1.0, 0.88, 0.62) * ring * mixEff;
      gl_FragColor = sanitize(c);
    }
  `,
};

let _composer = null;
let _lensPass = null;
let _renderer = null, _scene = null, _camera = null;
let _basePixelRatio = 1;

export function initPostFx(renderer, scene, camera) {
  _renderer = renderer; _scene = scene; _camera = camera;
  _basePixelRatio = renderer.getPixelRatio();
  if (HEADLESS) return null;
  _composer = new EffectComposer(renderer);
  _composer.addPass(new RenderPass(scene, camera));
  _lensPass = new ShaderPass(LENS_SHADER);
  _composer.addPass(_lensPass);
  const bloom = new UnrealBloomPass(
    // (o UnrealBloomPass já divide por 2 internamente e re-divide por mip —
    // o bloom acompanha a resolução adaptativa via composer.setPixelRatio)
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,   // strength — brilho dos emissores (sol/pulsar/disco/lasers)
    0.45,   // radius — espalhamento suave
    0.88,   // threshold — só o que é realmente brilhante floresce
  );
  _composer.addPass(bloom);
  _composer.addPass(new OutputPass());
  window.addEventListener('resize', () => {
    _composer.setSize(window.innerWidth, window.innerHeight);
  });
  return _composer;
}

// ── Resolução adaptativa ──────────────────────────────────────────────────────
const RES_STEPS = [1.0, 0.85, 0.7, 0.55];   // × do pixel-ratio base
let _stepIdx = 0;
let _ema = 1 / 60;          // média exponencial do frame-time
let _cooldown = 0;          // s até a próxima decisão (evita oscilar)

function _applyStep() {
  const pr = _basePixelRatio * RES_STEPS[_stepIdx];
  _renderer.setPixelRatio(pr);
  _renderer.setSize(window.innerWidth, window.innerHeight);
  // setPixelRatio do composer redimensiona TODOS os passes (bloom incluso).
  if (_composer) { _composer.setPixelRatio(pr); _composer.setSize(window.innerWidth, window.innerHeight); }
}

/** Chamar 1× por frame com o dt REAL (antes do clamp de física). */
export function updateAdaptiveRes(dt) {
  if (HEADLESS || !_renderer) return;
  _ema += (dt - _ema) * 0.08;
  _cooldown -= dt;
  if (_cooldown > 0) return;
  if (_ema > 0.026 && _stepIdx < RES_STEPS.length - 1) {
    _stepIdx++; _applyStep(); _cooldown = 1.5;
  } else if (_ema < 0.015 && _stepIdx > 0) {
    _stepIdx--; _applyStep(); _cooldown = 2.5;
  }
}

/** Atualiza a lente gravitacional. mix 0 desliga (custa ~nada no shader).
 *  shadow: 1 = buraco negro (miolo preto + aro), 0 = estrela de nêutrons (só warp). */
export function setLens(ndcX, ndcY, thetaScreen, mix, shipNdcX = 0, shipNdcY = -2, shadow = 1) {
  if (!_lensPass) return;
  const u = _lensPass.uniforms;
  u.uBH.value.set(ndcX * 0.5 + 0.5, ndcY * 0.5 + 0.5);   // NDC → UV
  u.uShip.value.set(shipNdcX * 0.5 + 0.5, shipNdcY * 0.5 + 0.5);
  u.uTheta.value = thetaScreen;
  u.uAspect.value = window.innerWidth / window.innerHeight;
  u.uMix.value = mix;
  u.uShadow.value = shadow;
}

// β da viagem p/ o tint relativístico de tela (chamado pelo loop principal).
export function setJourneyBeta(beta) {
  if (_lensPass) _lensPass.uniforms.uJBeta.value = beta;
}

// Pulso de transição de modo (0 = off). Chamado pelo loop principal.
export function setTransition(v) {
  if (_lensPass) _lensPass.uniforms.uTrans.value = v;
}

export function renderFrame() {
  if (_composer) _composer.render();
  else _renderer.render(_scene, _camera);
}
