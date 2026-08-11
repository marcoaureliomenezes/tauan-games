# Spec de réplica — Fiat Idea Adventure 1.8 16V Dualogic 2013 (prata)

Alvo: facelift 2011–2013 (farois grandes envolventes, grade com barra cromada
"ADVENTURE"), versão Adventure com estepe externo. Fotos de referência em
`docs/idea-ref/` (anúncio ML de um 2013 prata + 1 foto Wikimedia Commons).

## 1. Ficha técnica (fontes citadas)

| Medida | Valor | Fração do comprimento (4.207) |
|---|---|---|
| Comprimento (c/ estepe) | 4.207 mm | 1,000 |
| Largura | 1.753 mm | 0,417 |
| Altura (c/ rack) | 1.814 mm | 0,431 |
| Entre-eixos | 2.511 mm | 0,597 |
| Bitola diant./tras. | 1.469 / 1.451 mm | 0,349 / 0,345 |
| Vão livre do solo | 185 mm | 0,044 |
| Rodas/pneus | liga leve aro 15, 205/70 R15 (Ø ≈ 668 mm, r = 0,334) | — |
| Peso | ~1.330 kg | — |

Fontes: [heycar](https://heycar.com.br/ficha-tecnica/ficha-tecnica-do-fiat-idea-adventure-1-8-16v-2013),
[carrosnaweb](https://www.carrosnaweb.com.br/fichadetalhe.asp?codigo=4590),
[icarros](https://www.icarros.com.br/catalogo/fichatecnica.jsp?modelo=857&anomodelo=2013&versao=14181),
[autoo](https://www.autoo.com.br/fiat/idea/2013/adventure-18-16v-flex-manual-4p/) (aro 15 / 205-70 R15),
[fichacompleta](https://www.fichacompleta.com.br/carros/fiat/idea-adventure-1-8-16v-2013).

**Proporção-chave: o carro é MAIS ALTO do que largo (H/W = 1,035).** É isso que
faz o "monovolume". Balanço dianteiro curto (~0,20 L), tampa traseira quase
vertical; o estepe soma ~0,08 L atrás da tampa.

## 2. Sinais de identidade, RANKEADOS (o que grita "Idea Adventure")

1. **Estepe externo na tampa**, centrado, com capa/suporte preto em forma de
   "Y"/bumerangue deixando o aro e a banda do pneu visíveis, logo FIAT redondo
   no centro e "ADVENTURE" em relevo na base da capa.
2. **Cabine monovolume alta** — altura > largura, traseira quase vertical,
   área envidraçada enorme.
3. **Para-brisa muito inclinado e contínuo** com o capô curto (silhueta
   "one-box"); vidro sobe ~50–55° da horizontal, base quase na frente do capô.
4. **Cladding preto fosco ao redor de toda a parte baixa**: para-choques,
   alargadores de caixa de roda, frisos de porta (script "Adventure" na porta
   traseira), saias com inserto tubular prateado.
5. **Lanternas verticais altas** subindo pelas colunas D (vermelho vivo, com
   seção clara no topo), do topo do para-choque até quase o teto.
6. **Rack de teto**: longarinas tubulares prata sobre pés pretos + aerofólio
   preto integrado na borda traseira do teto.
7. **Frente do facelift**: faróis grandes varridos para trás (não são fendas
   finas!), barra cromada/prata na grade com lettering ADVENTURE + logo FIAT
   redondo vermelho, placa de skid prata no spoiler, neblinas redondos em
   molduras verticais prateadas nas extremidades.

## 3. Zonas de carroceria (frações de L = 4,207 m; nariz = +Z, eixo Z=0 no centro)

- Z nariz: para-choque termina em +0,50 L; eixo dianteiro em +0,299 L
  (balanço diant. ≈ 0,20 L). Eixo traseiro em −0,299 L; tampa em −0,44 L;
  estepe ocupa −0,44…−0,52 L (Ø 0,159 L), centrado em X=0, centro a ~0,52 H.
- Linha de cintura a ~0,53 H (~0,96 m); vidros laterais de ~0,53 H a ~0,82 H;
  teto a ~0,965 H (1,75 m), rack no topo até 1,0 H.
- Cladding: do vão livre (0,102 H) até ~0,30 H nas saias/portas; alargadores
  sobem ~0,06 L acima dos cubos das rodas.
- Para-brisa: base em +0,27 L (encontro com capô), topo em +0,02 L; capô
  curto e quase horizontal de +0,27 L a +0,47 L.

## 4. Cores (amostradas das fotos / visual)

| Elemento | Hex | Nota |
|---|---|---|
| Prata Bari (corpo) | `#B4B8B5` | prata claro neutro-quente; varia `#9C9893` (sombra) → `#C0C4C6` (sol) |
| Cladding plástico | `#2B2D2E` | preto fosco texturizado (amostrado `#2F2F2E`) |
| Skid plates / insertos | `#AEB4B8` | prata acetinado mais claro que a carroceria |
| Rack de teto | `#B9BEC2` tubos + `#1E1E1E` pés/aerofólio | |
| Vidros | `#232B33` quase opaco, leve azul | |
| Lanternas | `#B01E28` vermelho vivo + seção clara `#E8E6E0` | não fumê |
| Faróis | lente clara, interior prata `#D8DADD` | |
| Logo FIAT | vermelho `#A6161A` | |
| Rodas liga 15" | `#C9CCCE` | multi-raios (5 pares finos) |

## 5. Crítica do `idea-model.js` atual vs. fotos/ficha

1. **Silhueta comprida e baixa demais**: span ≈ 4,43 m × 1,705 m de altura
   (H/L ≈ 0,385) vs. real 4,207 × 1,814 (0,431). Encurtar span e subir o
   greenhouse (~+0,12 no teto) — o "alto e estreito" é a alma do carro.
2. **Entre-eixos 2,60** vs. real 2,511 → cubos em Z ±1,256, não ±1,3.
3. **Bitola larga demais**: cubos em X ±0,82 (bitola 1,64) vs. real 1,469 →
   ±0,735; as rodas ficam embutidas sob os alargadores, não aflushadas.
4. **Estepe descentrado (x=+0,12)** — no real é centrado. E a capa não é um
   disco cheio: é o "Y" preto aberto com aro/pneu visíveis + logo FIAT.
5. **Faróis pequenos/finos** (caixas 0,42×0,12 + máscara preta) — o facelift
   tem faróis GRANDES (~0,5 × 0,3) que sobem pelo para-lama. Maior erro da
   frente.
6. **Lanternas curtas e "fumê"** (`0x3d0d11`) — reais: vermelho vivo, ~0,55 m
   de altura, do topo do para-choque até quase o teto, coladas nos cantos.
7. **Retrovisores pretos** — no facelift são prata (cor da carroceria) com
   base preta; formato triangular arredondado.
8. **Rack tungstênio escuro** — real: tubos prata + pés pretos, e o aerofólio
   traseiro é integrado à borda do teto (hoje flutua separado).
9. **Vão livre**: saia a ~0,24 m; real 0,185 → descer ~5 cm.
10. **Grade tungstênio** — real: barra cromada/prata (`#C8CCD0`) com lettering
    ADVENTURE e logo redondo vermelho; laterais em mesh preto.
11. **Prata `0xA6A9AD` um pouco escuro/frio** — subir para ~`0xB4B8B5`.
12. **Faltam**: vigia triangular dianteira (quebra-vento) à frente do espelho,
    pilares B/C blackout formando banda de vidro contínua, antena stub no teto
    (à frente), limpador traseiro, refletores vermelhos no para-choque traseiro,
    badge "idea" à esquerda da tampa e "1.8 16V" à direita.
13. **Para-brisa**: rake do prisma ~33° da horizontal — muito deitado; real
    ~50–55°. Esticar a base até quase a frente do capô para a linha capô→vidro
    contínua (assinatura do modelo).
14. Rodas: r=0,335 ✓ (205/70 R15 = 0,334). Largura 0,24 ok.
