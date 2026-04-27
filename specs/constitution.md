# Constitution: tauan-games

> Este documento define as leis imutáveis que governam todo o desenvolvimento do tauan-games.
> Todo agente de IA trabalhando neste projeto DEVE seguir estas regras em toda tarefa.
> Atualizado apenas pelo arquiteto após revisão da equipe.

---

## Propósito do Projeto

tauan-games é um repositório de jogos casuais criados via Vibe Coding. O produto abriga jogos construídos com duas arquiteturas distintas:

1. **Arquitetura de jogos simples:** HTML5 + CSS puro + JavaScript vanilla — zero dependências, zero frameworks.
2. **Arquitetura de jogos complexos:** Golang — para jogos que exigem maior poder computacional, concorrência ou binários standalone.

O repositório organiza jogos como unidades auto-contidas, cada uma em seu próprio diretório, com specs próprias e evolução independente.

---

## Stack Tecnológica (Obrigatória)

### Jogos Simples

| Componente | Tecnologia | Versão mínima |
|---|---|---|
| Estrutura | HTML5 | — |
| Estilo | CSS3 puro | — |
| Lógica | JavaScript (ES6+) vanilla | — |
| Rendering | Canvas API | — |
| Game Loop | requestAnimationFrame | — |
| Persistência local | localStorage | — |
| Controle de versão | git | — |

### Jogos Complexos

| Componente | Tecnologia | Versão mínima |
|---|---|---|
| Linguagem | Go | 1.22+ |
| Build | go build | — |
| Rendering | Ebitengine ou equivalente | latest stable |

**Nenhuma tecnologia fora desta lista pode ser adicionada sem revisão e atualização desta constituição.**

**Nenhuma dependência externa (npm, pip, cargo, go get de terceiros) pode ser adicionada a jogos simples sem revisão e atualização desta constituição.**

---

## Princípios Fundamentais (Não-Negociáveis)

### Zero Dependências para Jogos Simples
Jogos da arquitetura HTML+CSS+JS NÃO podem usar:
- Frameworks JavaScript (React, Vue, Angular, etc.)
- Bibliotecas CSS (Bootstrap, Tailwind, etc.)
- Bibliotecas de jogo (Phaser, PixiJS, etc.)
- Bundlers ou transpilers (Webpack, Babel, etc.)
- Qualquer npm package

A única exceção é `localStorage` (Web API nativa).

### Zero APIs Externas
- **NUNCA** um jogo pode chamar APIs externas, serviços em nuvem ou endpoints remotos.
- **NUNCA** um jogo pode coletar, enviar ou armazenar dados pessoais de jogadores fora do navegador.
- **NUNCA** um jogo pode depender de conectividade de rede para funcionar.

### Auto-Contenção
- Cada jogo vive em seu próprio diretório sob `games/`.
- Cada jogo é executável abrindo seu `index.html` diretamente no navegador ou via servidor local simples.
- Cada jogo deve funcionar 100% offline após carregado.

### Vibe Coding
- Jogos são criados em sessões de Vibe Coding: especificação → implementação → refinamento visual e de jogabilidade.
- A estética e a diversão são objetivos de primeira classe, não apósthoughts.

---

## Segurança (Não-Negociáveis)

- **NUNCA** exponha credenciais, tokens ou secrets em código-fonte ou specs.
- **NUNCA** armazene dados pessoais de jogadores fora de `localStorage` do próprio navegador.
- **NUNCA** faça tracking, telemetry ou analytics de qualquer tipo.
- **SEMPRE** trate input do jogador de forma defensiva (ignorar teclas simultâneas, prevenir double-jump não intencional, etc.).

---

## Princípios de Arquitetura

### Separação de Concerns por Jogo
Cada jogo possui sua própria spec, seu próprio código e seus próprios assets. Nenhum jogo importa código de outro jogo.

### Game Loop Explícito
Todo jogo baseado em Canvas DEVE usar `requestAnimationFrame` como base do game loop. `setInterval` e `setTimeout` são proibidos para lógica de jogo principal.

### Rendering via Canvas
Jogos da arquitetura simples DEVEM usar Canvas API para rendering de elementos dinâmicos (jogador, obstáculos, chão). DOM manipulation é permitida apenas para UI estática (score display, start screen, game over screen).

### Estado Explícito
Cada jogo DEVE gerenciar seu estado de forma explícita (frozen objects, enums ou equivalentes). Estado mutável global é proibido.

### Ilustração e Estética
Jogos DEVEM priorizar qualidade visual. Personagens e elementos devem ser mais bem ilustrados do que equivalentes minimalistas (ex: o dinossauro do Tauansauro deve ser mais detalhado que o do Chrome Dino). Desenho procedural via Canvas é a técnica preferida.

---

## Workflow de Desenvolvimento (SDD)

- **NUNCA** implemente um jogo sem `SPEC.md` aprovado em `specs/features/<jogo>/`.
- **NUNCA** avance de fase (`SPEC.md` → `PLAN.md` → `TASKS.md` → implementação) sem aprovação humana explícita.
- Toda alteração em `specs/` deve passar por uma revisão de consistência de spec antes de ser considerada pronta.
- Se restarem conflitos, ambiguidades ou buracos após a revisão, eles devem ser registrados em `z_bug_specs.md` antes de qualquer implementação.
- Se a implementação divergir da spec, atualize a spec primeiro. Nunca ajuste a spec para justificar o código já escrito.

---

## Mapa de Responsabilidade das Specs

- `specs/constitution.md` é a fonte única das leis imutáveis do projeto.
- `specs/memory/product.md` é a fonte única da definição do produto e dos conceitos chave.
- `specs/memory/architecture.md` é a fonte única da arquitetura de jogos e da estrutura em disco.
- `specs/memory/tech-stack.md` é a fonte única da política de toolchain e tecnologias.
- `specs/foundation/SPEC.md` é a fonte única dos princípios de arquitetura, qualidade e convenções.
- `specs/SPEC.md` é a fonte única do comportamento top-level do produto.
- `specs/features/*/SPEC.md` possuem apenas contratos específicos de cada jogo.
- `specs/PLAN.md` e `specs/TASKS.md` são documentos derivados e não podem redefinir contratos dos documentos acima.

---

## Qualidade de Código

- Jogos simples devem funcionar nos 3 principais navegadores (Chrome, Firefox, Safari) em versões recentes.
- Código JavaScript deve seguir estilo consistente com ES6+.
- Nenhum `alert()`, `prompt()` ou `confirm()` em jogos.
- Nomes de variáveis e funções em snake_case; nomes de classes e construtores em PascalCase.
- Constantes de módulo em UPPER_SNAKE_CASE.
- Toda lógica de jogo deve ter comentários suficientes para que um agente de IA entenda o fluxo sem inspeção extensiva.
