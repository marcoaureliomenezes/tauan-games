# Backlog — Ideas

Ideias soltas de jogo, não-aprovadas para release. Documentação informal. Nada aqui
autoriza implementação. Quando uma ideia amadurecer com detalhamento mínimo (problema +
público-alvo + critério "Tauan-friendly"), promover para `candidates.md`.

## Convenções

- Cada ideia é um bullet de uma frase. Detalhar só se a ideia avançar para `candidates.md`.
- Ideias podem ser removidas a qualquer momento se forem rejeitadas ou virarem release.
- Não há ordem. Não há prioridade. Não há owner.

## Ideias atuais

- Jogo de fazenda 2D estilo Stardew light em Phaser para Tauan plantar/colher com poucos cliques.
- Modo "Foto Modo" no Aero Strike (câmera livre + screenshot) para Tauan tirar fotos das explosões.
- Mini-game de paraquedismo após ejeção no Aero Strike (atualmente ejeção = game over).
- Skins alternativas para o T-Rex (foguete, robô, gato) desbloqueáveis por high score.
- Modo cooperativo split-screen no T-Rex (Tauan vs operador no mesmo teclado).
- Versão 3D do Chrome Dino em Three.js como bridge entre tauan-trex (2D) e aero-fighters (3D).
- Primeiro experimento UE5 standalone (sem migrar Aero Strike) — algo pequeno, ex.: simulador de caminhão de lixo para Tauan.

## Retornos da CLOSURE space-war (2026-07-03)

- **Magnetar** como subclasse distinta de `NeutronStar` (adiado no SPEC da
  celestial-components; a base para herdar já existe).
- **Disco de detritos** opcional para `WhiteDwarf` (NASA: anãs brancas costumam ter
  discos de poeira/planetas sobreviventes).
- **Inimigos como atores N-body plenos** (a campanha usou rails body-relativos com
  ordnance sob gravidade — D-5; revisável se o combate pedir caça orbital de verdade).
- **Strip de `__swDebug`** do bundle publicado no Pages (hardening opcional apontado
  pela security review — jogo client-side, risco baixo).
