# VENDORS — componentes de terceiros pinados (bang-bang)

| Componente | Versão | Licença | Fonte | Uso |
|---|---|---|---|---|
| Terrain3D | v1.0.2-stable | MIT | https://github.com/TokisanGames/Terrain3D | terreno (LOD clipmap, splat, colisão) |
| ProtonScatter | 4.0 | MIT | https://github.com/HungryProton/scatter | dispersão de vegetação/rochas por regras de bioma |
| Quaternius packs (GLB) | — | CC0 | https://poly.pizza (ver `src/web-games/vendor/models/manifest.json`) | cavalo, cowboy, veado, cobra, NPCs, árvores, rochas, peças de trem |

Regras: tudo vendorado em `addons/` ou `assets/` — runtime 100% offline. Nunca
baixar em runtime. Atualizações de versão só com teste de boot + suite verde.

Avaliados para releases futuras (NÃO instalados ainda): Road Generator
(theduckcow, MIT) para estradas/carroças; SimpleGrassTextured (IcterusGames, MIT)
para grama interativa; Godot AI/dlight (MIT) como plugin de tooling no editor.
