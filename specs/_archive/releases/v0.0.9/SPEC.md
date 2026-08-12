# Security Spec: tauan-games

> **Status:** [ ] In Review

## Escopo

Segurança baseline para o repositório `tauan-games`, cobrindo:
- proteção contra vazamento de secrets
- hardening mínimo de dependências e pipeline
- publicação segura dos jogos web

Não inclui WAF, IAM avançado, SAST pago ou SOC.

## Requisitos

- **FR-S01**: Nenhuma API key, token ou credencial commitada ao repositório
- **FR-S02**: Dependências de jogos web sem vulnerabilidades conhecidas (`npm audit`)
- **FR-S03**: Jogos web publicados em HTTPS apenas
- **FR-S04**: Arquivos de configuração local com secrets devem existir somente como template versionado (`.env.example`), nunca `.env` real
- **FR-S05**: Pipeline deve bloquear merge quando houver secret detectado ou vulnerabilidade crítica/alta em dependências

## Requisitos Não Funcionais

- **NFR-S01 (Automação):** validações de segurança executadas em CI em toda PR
- **NFR-S02 (Tempo):** etapa de segurança da CI deve concluir em até 5 minutos por PR
- **NFR-S03 (Auditabilidade):** toda falha de segurança deve gerar mensagem clara com causa e ação esperada

## Critérios de Aceite

- **CA-S01:** scanner de secrets falha build ao detectar token/chave em arquivos rastreados
- **CA-S02:** `npm audit --audit-level=high` (ou equivalente) falha build com vulnerabilidades `high`/`critical`
- **CA-S03:** deploy/publicação recusa endpoint HTTP quando existir opção HTTPS
- **CA-S04:** nenhum arquivo `.env` com valor real pode ser adicionado ou alterado em commits

## Verificação

- `git log --all --full-history -- "*.env"` não contém arquivos `.env` reais
- scanner de secrets executa com retorno não-zero em caso de incidente
- auditoria de dependências sem findings `high`/`critical`
- checagem de URL de publicação garantindo `https://`

## Fora de Escopo

- rotação automática de secrets
- monitoramento de runtime (IDS/IPS)
- gestão centralizada de credenciais (Vault/KMS)

## Riscos e Mitigações

- **Risco:** falso positivo em scanner de secrets bloquear PR  
  **Mitigação:** allowlist versionada e revisada por código
- **Risco:** pacote transiente quebrar build por vulnerabilidade não explorável  
  **Mitigação:** política de exceção com prazo curto e issue rastreável

## Dependências

- CI ativa no repositório (GitHub Actions ou equivalente)
- Ferramenta de secret scanning definida (ex.: gitleaks/trufflehog)
- Node/npm disponíveis para auditoria de dependências dos jogos web
