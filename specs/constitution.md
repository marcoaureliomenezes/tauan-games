---
specs_pattern_version: 4
---
# Constitution: tauan-games

> Leis imutáveis. Todo agente de IA trabalhando neste projeto DEVE seguir estas regras.
> Nunca implemente sem um SPEC.md aprovado. Nunca avance de fase sem aprovação humana explícita.

---

## Propósito do Projeto

Repositório de jogos e experimentos interativos desenvolvidos por Tauan. Espaço de aprendizado e experimentação com desenvolvimento de jogos.

---

## Princípios de Desenvolvimento

1. **Projetos independentes** — cada jogo/experimento é uma pasta isolada _(exceção: tooling de qualidade compartilhado — `package.json` e `tests/` na raiz do repo são infraestrutura transversal, não lógica de jogo)_
2. **Simplicidade primeiro** — sem over-engineering; o objetivo é aprender e se divertir
3. **Documentação mínima** — README por jogo é obrigatório com instruções de como rodar. Documentos adicionais (`AGENTS.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`) são opcionais quando o jogo cresce além de 1 arquivo e precisa orientar agentes/colaboradores.

---

## Fluxo SDD (Spec-Driven Development)

```
SPEC.md [x Approved] → PLAN.md [x Approved] → TASKS.md [x Approved] → Implementação
```

Cada seta requer aprovação humana explícita. Não há exceção automática.

---

## Estrutura do Repositório

```
specs/
  constitution.md       ← este arquivo
  features/             ← uma pasta por jogo/feature
  memory/
    product.md
    tech-stack.md
  security/
<game-name>/            ← código de cada jogo
README.md
```
