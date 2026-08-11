# SPEC - Release: james-bond-browser-fps-v1

> **Status:** Aprovado
> **Aprovação:** 2026-07-18 - operador autorizou release paralela e execução direta
> **Release ID:** james-bond-browser-fps-v1
> **Owner:** product-engineer
> **Opened:** 2026-07-18

## 1. Objetivo

Entregar um FPS 3D standalone e offline em `src/web-games/james-bond/`, inspirado na estrutura de
missões, furtividade, arsenal e leitura visual de GoldenEye 007, com controles de PC
WASD + mouse. O jogo usa conteúdo visual, sonoro e narrativo original.

## 2. Escopo

- Campanha single-player com seis operações desbloqueáveis: Barragem, Complexo,
  Relay, Silo, Fragata e Controle na Selva.
- Cada fase tem briefing, três objetivos, extração, falha, vitória e progressão.
- Três dificuldades: Agent, Secret Agent e 00 Agent.
- Pistola, pistola silenciosa, SMG, rifle, shotgun, granada e mina remota.
- IA com patrulha, visão, audição, investigação, alerta, combate, busca e retorno.
- Tiros hitscan com dano localizado; explosões com falloff, oclusão e chain reaction.
- Áudio procedural espacial para tiros, passos, alarmes, impactos e explosões.
- HUD, minimapa/radar e mapa tático.
- Save versionado em localStorage e seletor de missão/dificuldade.

## 3. Requisitos funcionais

- **FR-01:** iniciar em menu de operações e entrar na primeira missão sem loading remoto.
- **FR-02:** usar WASD, mouse look, clique para atirar, RMB mirar, R recarregar,
  E interagir, Shift correr, C agachar, G granada, Q mina e M mapa.
- **FR-03:** impedir atravessar paredes e permitir movimento estável por corredores.
- **FR-04:** cumprir objetivos na ordem permitida e extrair apenas após os obrigatórios.
- **FR-05:** desbloquear a fase seguinte e persistir progresso localmente.
- **FR-06:** armas terem cadência, pente, reserva, recarga, recoil, spread, ruído e dano.
- **FR-07:** headshot causar mais dano; tiros em membros causarem reação distinta.
- **FR-08:** guardas perceberem visão e ruído, compartilharem alertas e buscarem o jogador.
- **FR-09:** alarmes gerarem reforços limitados e poderem ser desativados.
- **FR-10:** granadas/minas causarem dano radial ocluído, FX e reação em cadeia limitada.
- **FR-11:** passos, tiros e explosões mudarem conforme distância e ambiente.
- **FR-12:** radar revelar inimigos próximos, alertados ou que dispararam recentemente.
- **FR-13:** mapa tático exibir jogador, objetivos, extração e contatos permitidos.
- **FR-14:** pause automático ao perder pointer lock.

## 4. Requisitos não funcionais

- Static HTML/CSS/ES modules; sem build step e sem request externo em runtime.
- Three.js r165 e addons locais; componentes adicionais têm licença permissiva local.
- Nenhum asset, som, música, código ou geometria extraído de GoldenEye/James Bond.
- Estado testável em `window.game`; random seedado para simulações reproduzíveis.
- Sem erros de console; canvas não vazio; HUD sem sobreposição em desktop/mobile.
- Alvo 60 FPS, piso 30 FPS com qualidade adaptativa.

## 5. Aceitação

O jogo é aceito quando as seis fases podem ser iniciadas, jogadas e vencidas no
browser; controles, combate, IA, objetivos, áudio e mapa estão funcionais; testes
unitários/simulação e Playwright passam; e o servidor registrado oferece uma URL local.

## 6. Fora de escopo

Multiplayer, conteúdo licenciado da franquia, modelos humanos realistas, vozes, física
militar real e reprodução geométrica 1:1 dos mapas originais.
