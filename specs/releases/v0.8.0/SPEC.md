# SPEC — Release: v0.8.0

**Status:** Aprovado
**Release ID:** v0.8.0
**Owner:** product-engineer
**Opened:** 2026-08-10

---

## 1. Problem and context

Operador (2026-08-10), após o uplift v0.7.0: foco total no speed-run. O carro
precisa ser RÉPLICA do carro real dele — **Fiat Idea Adventure 2013 prata
(Dualogic), com estepe externo** — porque "meu filho quer dirigir o meu carro".
As pistas devem ser lapidadas estilo Top Gear: paisagem, placas, fundo com
parallax, sol, montanhas, árvores, música, nitro. E tolerância zero a defeitos
de relevo invisível — full scan obrigatório.

## 2. Objective

Speed-run impecável: Idea Adventure réplica fiel do carro do operador, 3 pistas
clássicas polidas (scenery completo + placas), nitro, música Top Gear, e scan
completo de relevo zerado.

## 3. Scope

- **R-01 — Réplica do Idea Adventure 2013 (P0):** pesquisa com ≥5 fotos reais
  (ângulos distintos, prata), ficha técnica, spec de réplica documentada em
  `docs/idea-adventure-replica-spec.md`, e rebuild do `idea-model.js` guiado
  pelas fotos (proporções, cladding, para-brisa rakeado, estepe com capa,
  roof rails, lanternas verticais, rodas 15").
- **R-02 — Full scan de relevo (P0):** scanner permanente
  (`tests/corrida/tools/full-scan.mjs`) dirigindo cada metro das pistas —
  rejeições de surfaceAt, eventos de cerca na pista, descontinuidades de
  relevo, flicker de superfície, cenário invadindo área dirigível, zonas de
  pouso. Zero findings críticos/altos ao final.
- **R-03 — Nitro (P1):** turbo com recurso limitado/regen, kick de aceleração,
  FOV/efeito visual, barra no HUD, tecla dedicada.
- **R-04 — Música Top Gear (P1):** engine Web Audio procedural (drums, baixo
  pulsante, lead saw), mix menu vs corrida, mute; referência Barry Leitch/SNES.
- **R-05 — Polimento das 3 pistas clássicas (P1):** placas ao redor da pista
  (sinalização), sol/sky reforçado, revisão de cenário por pista; sprint/Fuga
  mantida como palco do modo perseguição (fora do trio clássico — decisão
  registrada, operador pode vetar).
- **R-06 — Validação:** suite verde + probes + review visual do operador.

## 4. Out of scope

- Novos modos/pistas além do polimento; mudanças de engine; outros jogos.

## 5. Dependencies and risks

| Risco | Mitigação |
|---|---|
| Réplica não convencer o operador | spec com fotos + screenshots iterativos; ele valida |
| Scan achar defeitos estruturais caros | priorizar; documentar o que ficar |
| Conflito de edição entre workstreams | sequenciamento: scan → nitro/polimento; música isolada |
