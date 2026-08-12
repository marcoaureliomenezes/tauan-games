# Vendored model licenses

All models in this directory are **CC0 1.0 (Public Domain)**. No attribution
required. Downloaded on **2026-07-18** for the v0.3.1 release
(task T-FW-01). Everything is vendored locally — the game never fetches models
at runtime.

## Quaternius (quaternius.com) — CC0 1.0

Author: Quaternius (quaternius.com). All Quaternius packs are released under
CC0 1.0 Universal (Public Domain Dedication).

License verified two ways (2026-07-18):

1. Each Quaternius pack page on the official site
   (e.g. https://quaternius.com/packs/ultimateanimatedanimals.html — mirrored at
   https://github.com/Quaternius/quaternius.github.io/blob/master/packs/ultimateanimatedanimals.html)
   states `License CC0` and links to
   https://creativecommons.org/publicdomain/zero/1.0/.
2. Each individual model page on poly.pizza (Quaternius's official hosting
   partner, linked from the pack pages) states `CC0 1.0` / `Public Domain` and
   lists `Quaternius` as the author.

| File | Model | Source page | License |
|---|---|---|---|
| Horse.glb | Horse (26 clips: Idle/Walk/Gallop/Death/...) | https://poly.pizza/m/qvTrSG9pZF | CC0 1.0 |
| Deer.glb | Stag (26 clips) | https://poly.pizza/m/tQdzbZ1Cmw | CC0 1.0 |
| Snake.glb | Snake (4 clips) | https://poly.pizza/m/x9x0viZs8V | CC0 1.0 |
| Eagle.glb | Bird (static, no clips) | https://poly.pizza/m/gYYC0gYMnw | CC0 1.0 |
| Cowboy.glb | Adventurer (24 clips incl. Gun_Shoot/Run/Walk) | https://poly.pizza/m/ZwF0K7WBmu | CC0 1.0 |
| Woman.glb | Animated Woman (24 clips incl. Gun_Shoot/Run/Walk) | https://poly.pizza/m/nIItLV9nxS | CC0 1.0 |
| Native.glb | Tribal (rigged; limited clip set: Punch/HitReact/Death/Yes/No/Headbutt) | https://poly.pizza/m/t91lDHaqRW | CC0 1.0 |
| TrainEngine.glb | Locomotive Front (Modular Train) | https://poly.pizza/m/WY84FHug9s | CC0 1.0 |
| TrainWagon.glb | Locomotive Wagon (Modular Train) | https://poly.pizza/m/JCwr52pnuO | CC0 1.0 |
| TreePine.glb | Pine Trees | https://poly.pizza/m/oYtDty0fR6 | CC0 1.0 |
| TreeLeaf.glb | Trees (broadleaf) | https://poly.pizza/m/etFGNvsiFv | CC0 1.0 |
| Rock.glb | Rocks | https://poly.pizza/m/OQvi8PIZ40 | CC0 1.0 |

Direct GLB downloads were served from `static.poly.pizza` (poly.pizza's asset
CDN) at build time only.

## Notes / skipped candidates

- A true animated eagle/hawk: no CC0 specimen found. The animated eagles,
  hawks, crows and vultures on poly.pizza are `CC-BY` (Poly by Google and
  others) and were NOT vendored, per the CC0-only rule. `Eagle.glb` is a
  static CC0 Quaternius bird; flight should be animated procedurally.
- A more authentic animated "cowboy": the only CC0 cowboy-hat character found
  (`Cowboy` by mastjie, https://poly.pizza/m/S8hq7LEXTT) is a static unrigged
  mesh. The Quaternius `Adventurer` (full locomotion + gun clip set) was
  vendored instead as the gunslinger character.
- `Native.glb` (Quaternius `Tribal`) is rigged but its clip set lacks
  Walk/Run/Idle; a better-matching CC0 alternative (`Tribal Man` by Polygonal
  Mind, https://poly.pizza/m/vrdJP4oV26) is fully static. The animated one was
  kept.
- All other bird/train/character candidates found were CC-BY and were skipped.

## Inimigos animados (`enemies/` — james-bond), vendorizados 2026-07-24

Todos Quaternius (CC0 1.0), servidos por `static.poly.pizza` em build-time — o
jogo nunca busca modelos em runtime. Manifesto próprio em `enemies/manifest.json`
para que os demais jogos não carreguem estes arquivos.

Verificação de licença (2026-07-24): cada página de modelo em poly.pizza lista
`Quaternius` como autor e `CC0 1.0 / Public Domain`; os pacotes de origem são
"Animated Dinosaurs" (https://poly.pizza/bundle/Animated-Dinosaur-Bundle-SmoLdBLO2K)
e "Ultimate Monsters" (https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6),
ambos declarados CC0 pelo autor.

| File | Model | Source page | License |
|---|---|---|---|
| enemies/Velociraptor.glb | Velociraptor (6 clips: Idle/Walk/Run/Attack/Jump/Death) | https://poly.pizza/m/cnlGH2UcDd | CC0 1.0 |
| enemies/TRex.glb | T-Rex (6 clips: Idle/Walk/Run/Attack/Jump/Death) | https://poly.pizza/m/UYtneO5FpF | CC0 1.0 |
| enemies/Ghost.glb | Ghost (8 clips incl. Flying_Idle/Fast_Flying/Death) | https://poly.pizza/m/Iip30bDHmu | CC0 1.0 |
| enemies/Yeti.glb | Yeti (14 clips incl. Walk/Run/Punch/Death) | https://poly.pizza/m/ceRHrn8HHE | CC0 1.0 |
| enemies/Wizard.glb | Wizard (9 clips incl. Walk/Bite_Front/Death) | https://poly.pizza/m/o87Upt5uHX | CC0 1.0 |
| enemies/Demon.glb | Demon (14 clips incl. Walk/Run/Punch/Death) | https://poly.pizza/m/LnfIziKv4o | CC0 1.0 |

### Notas / candidatos descartados

- **Vampiro:** o pacote Ultimate Monsters não tem um vampiro literal. Os 44
  modelos foram enumerados e o `Wizard` (humanoide esguio de manto) foi o mais
  próximo; é retingido em runtime para leitura de vampiro. Nenhum vampiro CC0
  melhor foi encontrado.
- **Mixamo foi deliberadamente evitado.** O EULA da Adobe permite uso comercial
  do resultado, mas **proíbe a redistribuição dos arquivos** de personagem/animação
  — incompatível com vendorizar num repositório público. Nada de Mixamo entrou aqui.
- **Freesound / sons de criatura:** licença é por arquivo (muitos CC-BY, não CC0),
  então nenhum sample foi vendorizado. Os sons de inimigo do james-bond continuam
  100% sintetizados em Web Audio (`src/engine/audio.js`), o que também preserva
  a regra de "sem tela de loading".

## Carros (corrida/ — Cruis'n Tauan), vendorizados 2026-07-18

Todos Quaternius (CC0 1.0), servidos por `static.poly.pizza` em build-time —
o jogo nunca busca modelos em runtime.

| File | Model | Source page | License |
|---|---|---|---|
| cars/SUV.glb | SUV | https://poly.pizza/m/xsMtZhBkxL | CC0 1.0 |
| cars/SportsCarA.glb | Sports Car | https://poly.pizza/m/1mkmFkAz5v | CC0 1.0 |
| cars/SportsCarB.glb | Sports Car | https://poly.pizza/m/OyqKvX9xNh | CC0 1.0 |
| cars/SportsCarC.glb | Sports Car | https://poly.pizza/m/Gzj704DXdr | CC0 1.0 |
| cars/PickupTruck.glb | Pickup Truck | https://poly.pizza/m/qn4grQgHm8 | CC0 1.0 |
| cars/Truck.glb | Truck | https://poly.pizza/m/cXw6oiFtZ8 | CC0 1.0 |
