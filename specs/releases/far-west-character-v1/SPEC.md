# SPEC — Release: far-west-character-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 — operator playtest feedback, mandato direto:
> "o homem e o cavalo precisam ser uma coisa só junta... não quero bugs de
> sobreposição, o cavalo não pode atravessar as rochas... deve haver colisão...
> tiro não vai em direção à mira... tudo isso são bugs que devem ser trabalhados
> agora". Foco EXCLUSIVO no character (homem a cavalo); mapa/mundo fora desta release.
> **Release ID:** far-west-character-v1
> **Owner:** product-engineer
> **Opened:** 2026-07-18
> **Depends on:** far-west-uplift-v1

## 1. Problema

Playtest pós-uplift: (a) o cavaleiro AINDA lê como um homem em pé atravessando o
cavalo — pose de montaria não convincente; (b) o cavalo atravessa rochas ao subir
montanhas — não há colisão com objetos sólidos; (c) o tiro não vai na direção da
mira; (d) andar/correr/saltar precisam ler como uma figura única homem-cavalo.

## 2. Requisitos

- **R-01 — Figura única homem-cavalo:** pose de montaria convincente validada por
  screenshots de múltiplos ângulos (lado, 3/4 traseiro, frente) em parado, passo,
  trote, galope e salto: coxas abertas descendo pelos flancos do cavalo, joelhos
  dobrados, pés abaixo do corpo (estribos), tronco ereto em repouso, inclinação
  para frente progressiva com a velocidade, acompanhando o pitch do cavalo em
  subidas/descidas. ZERO interpenetração visível cavaleiro↔cavalo.
- **R-02 — Movimento coeso:** nas transições de marcha e no salto, cavaleiro e
  cavalo se movem como um sistema (sem deslize do cavaleiro sobre a sela durante
  aceleração, curva ou pulo; leve balanço de tronco permitido desde que ancorado).
- **R-03 — Colisão com o mundo sólido:** cavalo não atravessa rochas, troncos de
  árvores e construções. Colisores circulares/barreira registrados no scatter e
  nos assentamentos; resolução push-out + slide ao longo do obstáculo (nunca
  travar o jogador). O cavalo desliza/contorna, nunca penetra. Validado: cavalgar
  contra uma rocha grande por 5 s ⇒ zero penetração; subida de montante pedregoso
  ⇒ trajetória contorna os blocos.
- **R-04 — Mira = tiro:** o projétil/tracer e o ponto de impacto saem EXATAMENTE
  para onde a crosshair aponta, nas duas câmeras, parado ou no galope, mirando
  ou não. Raycast da câmera pelo centro da tela; tracer nasce no cano do revólver
  e termina no ponto de impacto. Validado: crosshair sobre uma rocha a 30 m ⇒
  impacto no ponto da crosshair (erro < 0.5 m); headless assert + screenshot.
- **R-05 — Sem regressões:** suíte `tests/far-west/` verde; controles CS mantidos
  (mouse mira, LMB atira, F ADS, espaço pula).

## 3. Fora de escopo

Mapa, minimapa, novas entidades, áudio novo, novos modelos GLB. Apenas character,
colisão e coerência mira/tiro.
