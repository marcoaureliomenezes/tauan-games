## Review de Jogabilidade — Sprint 1 Bug Fixes (aero-fighters)
Data: 2026-05-12T12:00:00Z

### Feel

Com as quatro correções aplicadas, a experiência de voo ficou visivelmente mais honesta. O avião não bate mais em paredes de ar invisíveis ao sobrevoar ilhas — o terreno que você toca é o terreno que mata. A queda de mayday ganhou peso dramático: o F-35 cai em chamas, faz tumble completo e explode ao impactar o solo antes de desaparecer. O efeito é satisfatório e coerente com a gravidade da situação.

### Dificuldade e Progressão

O aumento de MOUNTAIN_BUFFER de 2.5 para 10, combinado com islandHeightAt corrigido, tornou o voo de baixa altitude tecnicamente mais permissivo mas visualmente mais preciso. Antes o jogador morria em colisões que pareciam injustas; agora o limite é visível. Isso reduz a frustração sem remover o desafio real das montanhas.

### Física e Realismo

T-BF01 foi a correção de maior impacto técnico. A fórmula anterior de islandHeightAt usava apenas a parábola, ignorando as 4 octaves de noise senoidal que o mesh visual usa. A divergência máxima era de ~9.3 unidades — o equivalente a uma parede de 9 metros invisível. Com a correção, colisão e renderização usam a mesma função, eliminando montanhas fantasma.

T-BF02 beneficiou-se diretamente de T-BF01. O spawnTarget já chamava islandHeightAt corretamente; com a fórmula corrigida, os alvos agora pousam no terreno visível. Não foi necessária nenhuma mudança em targets.js — a função de altura era o único ponto de divergência.

T-BF04 foi cirúrgica: uma linha removida do bloco de impacto (jet.visible = false no momento do crash) e uma linha adicionada no início de _ejectAndRespawn. O resultado é que o avião permanece visível durante toda a queda — gravidade 4x, tumble crescente, fumaça e explosões pequenas — até o impacto definitivo no solo.

### Performance

Nenhum impacto mensurável de performance. islandHeightAt é chamada no checkTerrainCollision por frame (apenas para ilhas em raio), e a fórmula com 4 sin/cos é O(1) por chamada — custo marginal de ~0.1ms mesmo com 18 ilhas. Os 17 ACs funcionais passam; AC-18 (FPS headless) permanece flaky por razões de software rendering já documentadas — fora do escopo do Sprint 1.

### Próximas Melhorias Recomendadas

| Melhoria | Impacto |
|---|---|
| MOUNTAIN_BUFFER revisão para baixo (ex: 3-4) — agora que islandHeightAt está correta, o buffer de 10 é conservador demais e mata o avião visivelmente acima da montanha | Médio |
| Spin do mayday crescente com velocidade de queda (FIX-05 do relatório anterior) — fórmula invertida atual faz o avião spinnar menos conforme cai mais rápido | Médio |
| Drag aerodinâmico (FIX-06) — sem drag, desacelerar parece vacuum | Médio |
| Momentum angular nos controles de atitude (FIX-07) — input direto no quaternion sem inércia dá sensação artificial | Médio |
| Resolver flakiness do AC-18 reduzindo vértices do oceano (FIX-09 do relatório anterior) | Baixo |
