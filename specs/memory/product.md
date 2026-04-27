# Product: tauan-games

## O que é

**tauan-games** é um repositório de jogos casuais criados via Vibe Coding. O produto organiza jogos em duas arquiteturas distintas e oferece uma estrutura padronizada para specs, desenvolvimento e evolução de cada jogo de forma independente.

---

## Problema que Resolve

Jogos criados em sessões de Vibe Coding tendem a acumular débito técnico quando não seguem uma arquitetura consistente. Sem specs formais, cada jogo decide suas próprias convenções de código, estado, rendering e organização — resultando em código não-mantível e inconsistente.

O tauan-games resolve isso com:

- **Specs obrigatórias por jogo** — cada jogo tem seu `SPEC.md` antes de qualquer linha de código.
- **Duas arquiteturas claras** — jogos simples em HTML+CSS+JS vanilla; jogos complexos em Golang.
- **Auto-contenção** — cada jogo é independente, sem acoplamento entre jogos.
- **Vibe Coding disciplinado** — estética e diversão como objetivos de primeira classe, mas com fundamentos arquiteturais sólidos.

---

## Usuários

| Usuário | Como usa |
|---|---|
| Jogador casual | Abre o jogo no navegador e joga offline |
| Desenvolvedor / Vibe Coder | Cria jogos seguindo as specs e arquiteturas definidas |
| Agente de IA | Lê specs para implementar jogos de forma consistente com SDD |

---

## Conceitos Chave

### Vibe Coding
Metodologia de criação onde a especificação e a estética guiam a implementação. O foco é em jogos que são divertidos e visualmente atraentes, não apenas funcionais.

### Arquitetura de Jogos Simples
HTML5 + CSS3 puro + JavaScript ES6+ vanilla. Zero dependências externas. Rendering via Canvas API. Game loop via `requestAnimationFrame`. Funciona abrindo `index.html` no navegador.

### Arquitetura de Jogos Complexos
Golang com engine de rendering (ex: Ebitengine). Para jogos que exigem maior poder computacional, concorrência nativa ou distribuição como binário standalone. Futuro — nenhum jogo complexo está especificado ainda.

### Jogo Auto-Contido
Cada jogo vive em `games/<jogo-name>/` com seu próprio `index.html`, `style.css`, `game.js` e assets. Nenhum jogo importa código de outro jogo.

### Ciclo de Vida de um Jogo
1. Spec do jogo é criada em `specs/features/<jogo>/SPEC.md`
2. Spec é revisada e aprovada
3. PLAN.md e TASKS.md são derivados
4. Implementação segue as tasks
5. Jogo é refinado (estética, jogabilidade, dificuldade)

---

## Proposta de Valor

- **Para o jogador:** jogos casuais que funcionam 100% offline, sem instalação, sem tracking, sem dependências.
- **Para o desenvolvedor:** estrutura clara e specs que impedem débito técnico acumulado em sessões de Vibe Coding.
- **Para agentes de IA:** specs suficientes para implementar jogos consistentes sem decisões arquiteturais implícitas.
