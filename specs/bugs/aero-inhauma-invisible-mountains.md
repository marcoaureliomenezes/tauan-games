---
name: aero-inhauma-invisible-mountains
context: tauan-games
release_id: aero-fighters-world-realism-v1
session_id: null
reported_at: "2026-07-01"
severity: high
status: open
surface: aero-fighters — inhauma terrain grounding / helicopter altitude
---

# Bug: Inimigos "voando sobre montanha invisível" no mapa Inhauma

## Symptom (relato do operador)

"There are mountains that are not visible. I see enemies on the top of the mountain
flying. The mountain is invisible." — inimigos aparecem flutuando sobre o que parece ser
terreno vazio/plano no mapa `inhauma`.

## Investigation (2026-07-01, live scene inspection + screenshots, HEAD 30a3d69)

A montanha **não está totalmente invisível** no código commitado: o terreno é renderizado
por `inhaumaContinuousHeight` (uma verdade de superfície única para visual + colisão),
todos os 9 chunks estão `visible=true, frustumCulled=false`, maxY do chunk central 107 m,
e os 10 inimigos spawnados reportam `heightError=0`. Screenshots mostram morros/serras
renderizados. Logo, não é "objetos na altura da montanha sobre mesh ausente" no caso geral.

As causas reais (o que o operador provavelmente vê):

1. **Aliasing de pico agudo nas 2 serras `ridge`.** Espaçamento de vértice do mesh =
   `2600/54 ≈ 48 m`. O inimigo amostra o pico contínuo exato, mas o mesh só alcança os
   vértices da grade → a superfície renderizada fica **~7-9 m abaixo** do objeto nos cumes
   mais afiados:
   - `serra-sete-lagoas` aaGun `(760,-300)`: inimigo y=112.7, mesh ≈103.7 → ~9 m de float.
   - `serra-leste` `(1300,120)`: inimigo y=97.5, mesh ≈90.0 → ~7.5 m de float.
   Em qualquer outro ponto o gap é <1 m. Lê-se como "objeto pairando sobre o topo da
   montanha".
2. **Helicópteros voam 46 m acima do solo por design** (`config.js:125 HELI_ALTITUDE:46`,
   aplicado em `targets.js:356-357`). Sobre terreno quase plano (ex.: `(-206,193)` terreno
   7 m → heli a 53 m; `(1290,-511)` terreno 18 m → heli a 64 m), o heli paira ~46 m no ar
   com pouco relevo abaixo → lê-se como "inimigo flutuando onde deveria haver montanha".
3. **Armadilha latente:** o fallback de `heightFn` em `targets.js:341,346` usa
   `islandHeightAt`; na ilha virtual de Inhauma (`radius 1e9`) isso retorna ~120 m
   uniforme em todo lugar. Não é acionado no jogo normal (`missions.js` sempre passa
   `heightFn`), mas produziria **exatamente** o sintoma relatado se algum spawn futuro
   omitir o argumento.

## Expected

Onde há relevo de montanha e um objeto posicionado, o objeto senta na superfície visível
(sem float perceptível); helicópteros lêem como patrulha aérea deliberada, não como
"flutuando sobre montanha invisível".

## Fix (WS-1 desta release)

- Ancorar objetos na superfície **renderizada** nas serras (subir `TERR.seg` ou amostrador
  bilinear na mesma grade de 48 m; ou alargar a banda de `ridge` em `featureContribution`
  para o pico aliasar menos) — eliminar o float de ~7-9 m.
- Rever `HELI_ALTITUDE` e/ou reposicionar as entradas de helicóptero de
  `TARGET_LAYOUT_INHAUMA` para coordenadas de serra, para não pairarem sobre terreno plano.
- Endurecer o fallback em `targets.js:341,346` (`getActiveHeightFn()` ou assert non-null)
  para fechar a armadilha latente.

## Notes

Verificação final deve ser **em browser real** (não só headless 0.35×), via dev server +
screenshots, pois o relato é de jogo real. Evidência da investigação em screenshots de
sessão. Redigido sem paths locais/segredos.
