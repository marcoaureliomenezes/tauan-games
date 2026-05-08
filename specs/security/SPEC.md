# Security Spec: tauan-games

> **Status:** [ ] Draft

## Escopo

Segurança básica para repositório de jogos — foco em não expor secrets e manter dependências seguras.

## Requisitos

- **FR-S01**: Nenhuma API key, token ou credencial commitada ao repositório
- **FR-S02**: Dependências de jogos web sem vulnerabilidades conhecidas (`npm audit`)
- **FR-S03**: Jogos web publicados em HTTPS apenas

## Verificação

- `git log --all --full-history -- "*.env"` retorna vazio
- `npm audit` (ou equivalente) sem vulnerabilidades críticas
