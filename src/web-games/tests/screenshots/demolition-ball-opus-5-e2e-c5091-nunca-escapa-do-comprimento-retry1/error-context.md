# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demolition-ball-opus-5/e2e.spec.js >> a bola pendula: fica presa ao cabo e nunca escapa do comprimento
- Location: tests/demolition-ball-opus-5/e2e.spec.js:55:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Tearing down "context" exceeded the test timeout of 30000ms.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]: Contrato 1 — Aquecendo a bola
    - generic [ref=e5]: Derrube a casa condenada. Ganhe embalo no pêndulo antes de bater.
    - generic [ref=e7]:
      - generic [ref=e8]: 0%
      - generic [ref=e9]: "--:--"
    - list [ref=e10]:
      - listitem [ref=e11]:
        - generic [ref=e12]: Casa — Rua Marreta, 718
        - generic [ref=e13]: 0%
  - generic [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e16]: Caixa
      - generic [ref=e17]: $0
    - generic [ref=e18]:
      - generic [ref=e19]: Velocidade
      - generic [ref=e20]: 0 km/h
    - generic [ref=e21]:
      - generic [ref=e22]: Cabo
      - generic [ref=e23]: 13.0 m
    - generic [ref=e24]:
      - generic [ref=e25]: Bola
      - generic [ref=e26]: 0.0 m/s
  - generic [ref=e27]:
    - text: W A S D dirigir o trator
    - text: Q / E girar a lança · R / F subir / baixar
    - text: Z / X encurtar / soltar cabo
    - text: ESPAÇO impulso no pêndulo · SHIFT puxar
    - text: M mapa · V câmera · N som · arrastar = olhar
  - generic:
    - generic: Contrato 1 — Aquecendo a bola
    - generic: Derrube a casa condenada. Ganhe embalo no pêndulo antes de bater.
  - generic [ref=e28]:
    - heading "DEMOLITION BALL" [level=1] [ref=e29]
    - paragraph [ref=e30]: "Você opera um trator-guindaste com bola de demolição de 4,2 toneladas. A bola é um pêndulo de verdade: acelere, gire a lança e solte cabo para ganhar amplitude — depois acerte a estrutura no ponto mais baixo do arco, onde a energia é máxima. Corte a base e o prédio desaba sozinho."
    - generic [ref=e31]:
      - generic [ref=e32]: W A S D dirigir
      - generic [ref=e33]: Q E girar lança
      - generic [ref=e34]: R F elevar lança
      - generic [ref=e35]: Z X cabo
      - generic [ref=e36]: ESPAÇO impulso
      - generic [ref=e37]: M mapa da cidade
    - generic [ref=e38]: CLIQUE OU PRESSIONE UMA TECLA PARA COMEÇAR
  - generic [ref=e39]: WEBGL2 PURO — RENDERER, FÍSICA E ÁUDIO ESCRITOS DO ZERO
```