// idea-model.js — Fiat Idea Adventure 2013 (prata) PROCEDURAL v2: réplica fiel
// guiada pelas fotos reais em docs/idea-ref/ + docs/idea-adventure-replica-spec.md
// (nariz = +Z, escala 1 unidade = 1 m, eixo Z=0 no centro da carroceria).
// Deltas v1→v2: entre-eixos real 2.511 (cubos ±1.256), bitola real (±0.74),
// monovolume mais ALTO (teto 1.66, rack até ~1.80 — H>L, a alma do carro),
// para-brisa mais ereto (~38°), vigia triangular dianteira + banda de vidro
// contínua com pilares B/C blackout, friso de porta na altura da maçaneta,
// faróis GRANDES envolventes (facelift 2011-13), grade com máscara preta +
// barra prata + logo FIAT vermelho, neblinas duplos em pods pretos, skid
// plates prata, lanternas verticais vermelho-vivo com seção clara no topo,
// rack prata com pés pretos + defletor integrado, rodas de liga PRATA com 5
// raios, e o estepe externo CENTRADO com a capa boomerangue cinza: barra
// central + 2 cintas prata em V/X + logo FIAT — a assinatura do Adventure.
// Geometria estática fundida por material; rodas como nós "wheel*" na origem
// com a geometria deslocada até o cubo — a MESMA convenção dos GLB Quaternius,
// para o rigWheels do cars.js recentrar no cubo e criar o pivô de giro/esterço.

import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/jsm/utils/BufferGeometryUtils.js';

// paleta amostrada das fotos (spec §4)
const MAT = {
  silver: new THREE.MeshStandardMaterial({ color: 0xB4B8B5, roughness: 0.4, metalness: 0.35 }), // prata Bari
  trim: new THREE.MeshStandardMaterial({ color: 0xAEB4B8, roughness: 0.35, metalness: 0.6 }),   // prata acetinado: skid/rack/raios/cintas
  dark: new THREE.MeshStandardMaterial({ color: 0x5E6062, roughness: 0.6, metalness: 0.2 }),    // capa do estepe / retrovisores
  plastic: new THREE.MeshStandardMaterial({ color: 0x343638, roughness: 0.85, metalness: 0.05 }), // cladding preto fosco
  tire: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9, metalness: 0.0 }),
  glass: new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.14, 0.17, 0.2), roughness: 0.15, metalness: 0.2,
    transparent: true, opacity: 0.92,
  }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xf4f2e4 }),   // faróis/neblinas: não-sombreado
  tail: new THREE.MeshBasicMaterial({ color: 0xB01E28 }),   // lanternas vermelho-vivo
  tailClear: new THREE.MeshBasicMaterial({ color: 0xE8E6E0 }), // seção clara do topo
  logo: new THREE.MeshBasicMaterial({ color: 0xA6161A }),   // logo redondo FIAT
};

function box(w, h, l, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, l);
  g.translate(x, y, z);
  return g.toNonIndexed();            // mergeGeometries exige índice uniforme
}

function cylZ(r, h, x, y, z, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.rotateX(Math.PI / 2);             // eixo → Z (estepe/neblina/logo na tampa/grade)
  g.translate(x, y, z);
  return g.toNonIndexed();
}

// prisma triangular extrudado na LARGURA (X): seção no plano (u=Z longitudinal,
// v=Y altura) definida por 3 pontos [u,v]. Mesma técnica do para-brisa da v1.
function triPrismX(p1, p2, p3, width, xCenter) {
  const s = new THREE.Shape();
  s.moveTo(p1[0], p1[1]);
  s.lineTo(p2[0], p2[1]);
  s.lineTo(p3[0], p3[1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);            // u → +Z, extrusão Z → −X
  g.translate(xCenter + width / 2, 0, 0);
  return g;                           // Extrude já é não-indexada
}

const WHEEL_R = 0.335, WHEEL_W = 0.24;
const HUB_X = 0.74, HUB_Y = WHEEL_R, HUB_Z = 1.256;   // bitola/entre-eixos reais

// Convenção GLB Quaternius: nó "wheel*" NA ORIGEM do modelo, malhas deslocadas
// até o cubo — rigWheels (cars.js) calcula o bbox, recentra a geometria e
// cria o pivô no cubo (rotation.x = rolagem, rotation.y = esterço dianteiro).
// Liga leve PRATA aro 15: aro + 5 raios + tampa central fundidos em 1 mesh.
function wheelNode(name, hx, hy, hz) {
  const node = new THREE.Group();
  node.name = name;

  const tireGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 20, 1, true);
  tireGeo.rotateZ(Math.PI / 2);       // eixo → X (largura do carro); sem tampas:
                                      // a lateral aberta deixa o aro PRATA aparecer
  const tire = new THREE.Mesh(tireGeo, MAT.tire);
  tire.position.set(hx, hy, hz);

  // aro ESCURO + raios PRATA (liga 15" clara sobre borracha, como nas fotos):
  // construídos de frente (eixo Z), depois girados p/ eixo X. Aro 0.248 de
  // largura: orgulhoso do pneu (0.24) → cobre a borda aberta do pneu.
  const discGeo = cylZ(0.21, 0.248, 0, 0, 0, 16);                   // aro (fundo escuro)
  discGeo.rotateY(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, MAT.tire);
  disc.position.set(hx, hy, hz);

  const parts = [];
  for (let k = 0; k < 5; k++) {
    const spoke = new THREE.BoxGeometry(0.055, 0.17, WHEEL_W + 0.012);
    spoke.translate(0, 0.125, 0);
    spoke.rotateZ((k * 2 * Math.PI) / 5);
    parts.push(spoke.toNonIndexed());
  }
  parts.push(cylZ(0.05, 0.255, 0, 0, 0, 12));                       // tampa do cubo
  const rimGeo = mergeGeometries(parts, false);
  rimGeo.rotateY(Math.PI / 2);        // face da roda: Z → X
  const rim = new THREE.Mesh(rimGeo, MAT.trim);
  rim.position.set(hx, hy, hz);

  node.add(tire, disc, rim);
  return node;
}

export function buildIdeaModel() {
  const silver = [], glass = [], plastic = [], trim = [], dark = [];
  const lamp = [], tail = [], tailClear = [], logo = [];

  // ── carroceria (prata Bari) ─────────────────────────────────────────────
  silver.push(box(1.70, 0.58, 3.86, 0, 0.70, 0.02));        // corpo inferior (0.41→0.99)
  silver.push(box(1.60, 0.10, 0.85, 0, 1.00, 1.50));        // capô curto
  silver.push(box(1.56, 0.16, 2.20, 0, 1.58, -0.72));       // teto (1.50→1.66)
  for (const sx of [-1, 1])
    silver.push(box(0.20, 0.58, 0.10, sx * 0.74, 1.25, -1.855)); // colunas D

  // ── vidros ──────────────────────────────────────────────────────────────
  // para-brisa ~38° contínuo com o capô: base z=1.06 (y=1.00) → topo z=0.34 (y=1.56)
  glass.push(triPrismX([1.06, 1.00], [0.34, 1.00], [0.34, 1.56], 1.48, 0));
  for (const sx of [-1, 1]) {
    glass.push(box(0.04, 0.50, 2.40, sx * 0.79, 1.26, -0.50));   // banda contínua (vidros das portas + vigia traseira)
    // vigia triangular dianteira (quebra-vento) à frente da janela da porta
    glass.push(triPrismX([0.98, 1.01], [0.70, 1.01], [0.70, 1.42], 0.05, sx * 0.765));
  }
  glass.push(box(1.28, 0.46, 0.05, 0, 1.24, -1.885));            // vigia da tampa

  // ── cladding Adventure (plástico preto fosco) ───────────────────────────
  plastic.push(box(1.72, 0.22, 3.90, 0, 0.31, 0.02));            // saia/underbody (vão livre ~0.20)
  plastic.push(box(1.78, 0.36, 0.26, 0, 0.50, 1.93));            // para-choque dianteiro
  plastic.push(box(1.78, 0.34, 0.22, 0, 0.48, -1.90));           // para-choque traseiro
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    plastic.push(box(0.10, 0.36, 0.98, sx * 0.86, 0.60, sz * HUB_Z)); // alargadores de caixa de roda
  for (const sx of [-1, 1]) {
    plastic.push(box(0.06, 0.30, 1.80, sx * 0.865, 0.70, -0.05));  // FRISO DE PORTA largo (faixa das duas portas, cladding)
    plastic.push(box(0.10, 0.24, 1.70, sx * 0.85, 0.40, -0.05));   // saia lateral
    plastic.push(box(0.30, 0.24, 0.08, sx * 0.60, 0.52, 2.03));    // pods dos neblinas
    plastic.push(box(0.05, 0.50, 0.10, sx * 0.795, 1.26, -0.10));  // pilar B blackout
    plastic.push(box(0.05, 0.50, 0.12, sx * 0.795, 1.26, -1.02));  // pilar C blackout
    plastic.push(box(0.03, 0.045, 0.15, sx * 0.885, 0.93, 0.42));  // maçaneta dianteira
    plastic.push(box(0.03, 0.045, 0.15, sx * 0.885, 0.93, -0.55)); // maçaneta traseira
    plastic.push(box(0.07, 0.06, 0.12, sx * 0.55, 1.69, 0.30));    // pé do rack (diant.)
    plastic.push(box(0.07, 0.06, 0.12, sx * 0.55, 1.69, -1.55));   // pé do rack (tras.)
  }
  plastic.push(box(1.20, 0.10, 0.08, 0, 0.89, 1.99));            // máscara negra da grade
  plastic.push(box(1.34, 0.07, 0.26, 0, 1.70, -1.72));           // defletor traseiro integrado ao teto
  plastic.push(box(0.34, 0.025, 0.025, 0.05, 1.08, -1.915));     // limpador traseiro
  const antenna = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8);
  antenna.translate(0, 1.73, 0.20);                              // antena stub no teto (dianteira)
  plastic.push(antenna.toNonIndexed());

  // ── prata acetinado: rack, skid plates, grade, cintas do estepe ─────────
  for (const sx of [-1, 1]) {
    trim.push(box(0.05, 0.06, 2.10, sx * 0.55, 1.735, -0.62));   // longarinas prata do rack
    trim.push(box(0.04, 0.08, 1.50, sx * 0.905, 0.36, -0.05));   // inserto prata da saia
  }
  trim.push(box(0.80, 0.10, 0.10, 0, 0.35, 2.045));              // skid plate dianteiro
  trim.push(box(0.90, 0.09, 0.08, 0, 0.33, -2.00));              // skid plate traseiro
  trim.push(box(0.70, 0.09, 0.06, 0, 0.89, 2.03));               // barra prata da grade

  // ── ESTEPE EXTERNO centrado — capa boomerangue + cintas em V (assinatura) ─
  const spareTire = cylZ(0.335, 0.20, 0, 0.92, -2.02);           // pneu visível ao redor da capa
  dark.push(cylZ(0.30, 0.24, 0, 0.92, -2.03));                   // capa cinza-titânio
  dark.push(box(0.14, 0.55, 0.03, 0, 0.88, -2.155));             // barra central da capa
  for (const sx of [-1, 1]) {
    const strap = new THREE.BoxGeometry(0.07, 0.40, 0.025);      // cinta prata diagonal
    strap.rotateZ(sx * 0.68);                                    // ~39° — do logo p/ a borda inferior
    strap.translate(sx * 0.12, 0.85, -2.165);
    trim.push(strap.toNonIndexed());
  }

  // ── retrovisores (cinza escuro) ─────────────────────────────────────────
  for (const sx of [-1, 1])
    dark.push(box(0.10, 0.13, 0.22, sx * 0.93, 1.16, 0.62));

  // ── iluminação (não-sombreada) ──────────────────────────────────────────
  for (const sx of [-1, 1]) {
    lamp.push(box(0.50, 0.20, 0.06, sx * 0.50, 0.98, 1.96));     // farol GRANDE envolvente
    lamp.push(box(0.06, 0.14, 0.28, sx * 0.82, 0.96, 1.80));     // varrido p/ trás no para-lama
    lamp.push(cylZ(0.055, 0.04, sx * 0.40, 0.98, 1.99, 14));     // projetor interno
    lamp.push(cylZ(0.065, 0.04, sx * 0.61, 1.00, 1.99, 14));     // projetor externo
    lamp.push(cylZ(0.045, 0.04, sx * 0.60, 0.46, 2.06, 12));     // neblina inferior
    lamp.push(cylZ(0.045, 0.04, sx * 0.60, 0.58, 2.06, 12));     // neblina superior
    tail.push(box(0.16, 0.46, 0.08, sx * 0.80, 0.95, -1.93));    // lanterna vertical (canto, coluna D)
    tailClear.push(box(0.16, 0.10, 0.08, sx * 0.80, 1.23, -1.93)); // seção clara no topo
    tail.push(box(0.16, 0.05, 0.03, sx * 0.60, 0.42, -2.015));   // refletor do para-choque
  }
  logo.push(cylZ(0.05, 0.03, 0, 0.89, 2.065, 16));               // logo FIAT na grade
  logo.push(cylZ(0.055, 0.03, 0, 1.04, -2.175, 16));             // logo FIAT na capa do estepe

  const root = new THREE.Group();
  root.name = 'ideaAdventure';
  const addMerged = (geos, mat, name) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.name = name;
    root.add(m);
  };
  addMerged(silver, MAT.silver, 'body');
  addMerged(glass, MAT.glass, 'glass');
  addMerged(plastic, MAT.plastic, 'cladding');
  addMerged(trim, MAT.trim, 'trim');
  addMerged(dark, MAT.dark, 'darkTrim');
  addMerged(lamp, MAT.lamp, 'lamps');
  addMerged(tail, MAT.tail, 'taillights');
  addMerged(tailClear, MAT.tailClear, 'taillightsClear');
  addMerged(logo, MAT.logo, 'logos');
  const spare = new THREE.Mesh(spareTire, MAT.tire);
  spare.name = 'spareTire';
  root.add(spare);

  // ── rodas 205/70 R15 (r=0.335, largura 0.24) nos cubos reais ────────────
  root.add(wheelNode('wheelFL', -HUB_X, HUB_Y, HUB_Z));
  root.add(wheelNode('wheelFR', HUB_X, HUB_Y, HUB_Z));
  root.add(wheelNode('wheelRL', -HUB_X, HUB_Y, -HUB_Z));
  root.add(wheelNode('wheelRR', HUB_X, HUB_Y, -HUB_Z));

  return root;
}
