# PLAN — Release: v0.8.0

> **Status:** Aprovado
> **Release ID:** v0.8.0
> **Spec:** `SPEC.md`

---

## Sequência

1. **Pesquisa Idea** (explore): fotos prata 5+ ângulos + ficha técnica +
   `docs/idea-adventure-replica-spec.md` com crítica do modelo atual.
2. **Full scan** (coder): scanner permanente + correções até zero findings.
3. **Música** (coder, isolada): `src/music.js` procedural + integração mínima.
4. **Réplica v2** (coder): rebuild do `idea-model.js` a partir da spec de fotos;
   screenshots por ângulo confrontados com as referências.
5. **Nitro** (coder): física (boost + regen), HUD, tecla, efeito visual.
6. **Polimento de pistas** (coder): placas/sinalização, sol, revisão cenário.
7. **Fechamento**: suite + probes, review visual, memory sync, doctor.

## Dependências entre workstreams

- 4 depende de 1 (spec de fotos). 5 e 6 dependem de 2 (arquivos livres).
- 3 é independente (arquivo novo + 4 linhas de integração).

## Notas de design (para os workstreams)

### Nitro (R-03)
- Recurso: carga 100 pts, consome ~33/s segurando, regen ~8/s (dobro em reta
  sem colisão por 3 s). Boost: multiplica aceleração ×1.8 e levanta o teto de
  velocidade em +25% enquanto ativo — sentir, não quebrar o balance.
- Feedback: FOV +6°, leve shake, trilha de exaustão; barra no HUD ao lado do
  velocímetro. Tecla Shift (esq). Sem nitro em uso → sem efeito (vazio seco).
- IA não usa nitro (ou usa raramente, telegrafado) — decisão do implementador,
  documentar.

### Placas / sinalização (R-05)
- Placas de curva (chevrons) ANTES de cada curva com κ acima do limiar — geradas
  dos dados da spline (não manuais); placas de lombada antes das rampas;
  placa de vado na sprint. Mesma família visual das existentes (canvas, atlas).
- Sol: posição/elevação coerente com a sombra existente por pista; lens-flare
  sprite simples opcional; sky dome já tem sol baked — alinhar direção.
