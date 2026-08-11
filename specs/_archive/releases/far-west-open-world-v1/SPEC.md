# SPEC — Release: far-west-open-world-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operator demand + full-autonomous execution mandate
> ("release definition até implementation, só pare quando eu puder jogar com meu filho").
> O wording do operador é o outcome do grill; open questions resolvidas por decisão
> de escopo registrada em D-1..D-4 abaixo.
> **Release ID:** far-west-open-world-v1
> **Owner:** product-engineer
> **Opened:** 2026-07-18
> **Consumes:** `specs/backlog/far-west-open-world-v1.md`

## 1. Problema

O tauan-games não tem nenhum jogo de mundo aberto em terreno natural nem nenhum jogo
de cavalgada. O operador quer um jogo de faroeste jogável no browser com o filho:
um cowboy a cavalo percorrendo paisagens exuberantes (montanhas, florestas temperadas,
rios) para caçar bandidos fugitivos, com caça a veados para alimentação, acampamento,
cidades vivas, aldeias indígenas hostis e um trem cruzando o mapa.

## 2. Escopo escolhido

### Backlog consumido

| Item | Decisão | Cobertura |
|------|---------|-----------|
| `far-west-open-world-v1` | Picked e consumido integralmente | Requisitos R-01 a R-14 |

### Bugs e auditorias

Nenhum. Jogo novo, sem superfície preexistente.

### Decisões de escopo (operator mandate — grill resolvido pelo orquestrador)

- **D-1 — Estilo visual:** low-poly estilizado (packs GLTF CC0 Quaternius/Kenney
  vendorados em `vendor/models/`). O "bem realista" do pedido é atendido no
  *comportamento* (terreno, cavalgada, travessia de rios, ciclo dia/noite), não em
  fotorrealismo — inviável offline sem build step em hardware modesto.
- **D-2 — Captura de bandidos:** 5 fugitivos no mapa. Ao ser atingido, o bandido se
  rende (mãos ao alto); o jogador se aproxima a ≤4 m para capturar. Contador no HUD.
  Sem economia/recompensa nesta versão.
- **D-3 — Persistência:** nenhuma (sessão única). Reset ao recarregar.
- **D-4 — Mapa:** 2048×2048 m, heightmap procedural com seed fixa (mundo idêntico a
  cada sessão, testável), biomas por altitude/umidade, ciclo dia/noite lento.
- **D-5 — Exceção de assets (emenda ao princípio "tudo procedural"):** modelos GLTF
  CC0 commitados em `vendor/models/`. Offline absoluto mantido — nenhum fetch em
  runtime. Props simples (tendas, cercas, acampamento, prédios das cidades) seguem
  procedurais low-poly se o pack correspondente não couber.

## 3. Requisitos

- **R-01 — Jogo standalone:** pasta própria `far-west/`, isolada dos outros jogos;
  compartilhamento só de `vendor/`, `tests/` e `package.json`.
- **R-02 — Runtime estático e offline:** `index.html` + ES modules, sem build step,
  sem CDN, sem fetch externo em runtime; funciona em servidor estático e GitHub Pages.
- **R-03 — Stack:** Three.js r165 (`vendor/three.module.min.js`) + addons r165
  vendorados em `vendor/jsm/` (GLTFLoader, Sky, PointerLockControls) + simplex-noise
  vendorado. JS puro, zero TypeScript. Módulos `src/*.js` ≤ 250 linhas.
- **R-04 — Mundo aberto:** terreno 2048×2048 m procedural (seed fixa) em chunks com
  LOD, montanhas no horizonte, florestas temperadas, colinas e trilhas; heightmap
  query (interpolação bilinear) compartilhada por toda entidade.
- **R-05 — Rios e travessia:** rios com água animada; trechos rasos (vaus)
  atravessáveis a cavalo com redução de velocidade; trechos profundos intransponíveis
  exceto por pontes de madeira.
- **R-06 — Cavalgada:** cavalo com marchas (parado/passo/trote/galope), aceleração e
  curvas suaves, alinhamento do corpo à inclinação do terreno, stamina que limita o
  galope. Experiência de navegação o mais realista possível dentro do estilo low-poly.
- **R-07 — Câmeras:** alternância 1ª pessoa (posição dos olhos do cowboy, cabeça do
  cavalo visível) / 3ª pessoa (follow cam com cowboy + cavalo) por tecla [V].
- **R-08 — Combate:** revólver; [F] mira (zoom leve + precisão), [espaço] atira
  (hitscan com dispersão), recarga [R], munição limitada com reserva.
- **R-09 — Caça e alimentação:** veados em bandos que fogem; ao abater um veado o
  jogador o carrega (um por vez) e entrega no acampamento para encher o medidor de
  comida. Fome desce lentamente; fome zerada drena vida.
- **R-10 — Acampamento:** local fixo com fogueira, tenda e suprimentos; ponto de
  entrega de caça e de recuperação de vida/munição.
- **R-11 — Assentamentos:** 2 cidades de faroeste com construções típicas (saloon,
  banco, hotel, loja, estações), NPCs caminhando e carroças em rotas; 2 aldeias
  indígenas com ≤10 arqueiros cada que atacam com flechas quando o jogador se
  aproxima (<40 m) e podem ser revidados.
- **R-12 — Trem:** linha férrea atravessando o mapa com trem (locomotiva + vagões)
  circulando em spline, com cruzamento sinalizado.
- **R-13 — Fauna ambiental:** veados, cobras (atacam se pisadas/perto, veneno leve),
  águias circulando sobre os vales.
- **R-14 — Mapa e HUD:** tecla [M] abre mapa fullscreen com relevo, rios, cidades,
  aldeias, acampamento e marcadores dos bandidos; minimapa no canto; HUD com vida,
  stamina, fome, munição e bandidos capturados.
- **R-15 — Qualidade:** smoke Playwright (boot offline, zero console errors, zero
  requests externos, canvas renderiza, estado `window.game` expõe mundo/entidades);
  link no catálogo `index.html` do repo; README do jogo.

## 4. Fora de escopo

Multiplayer, save/persistência, economia/recompensas, diálogos, missões além do loop
de captura, fotorrealismo, som licenciado (áudio sintetizado WebAudio apenas),
mobile/touch controls.
