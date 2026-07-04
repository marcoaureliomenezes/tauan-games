# SPEC — Release: space-war-interstellar-journey-v1

> **Status:** Aprovado — 2026-07-04 (operador; decisões AskUserQuestion: ship-first ✓,
> [Z] contextual ✓, relatividade REALISTA ✓)
> **Origem:** demanda do operador 2026-07-04 ("navegamos no nada entre sistemas") +
> brief `physics-brief-interstellar-travel.md` (brachistochrone, aberração, Doppler,
> bulge galáctico, Terrell–Penrose).
> **Base:** feature/space-war-physics-fidelity-v1 (PR #15). **Segment:** rc-1

## 1. Objetivo

Viajar entre sistemas deve ser atravessar uma GALÁXIA: [T] mira o sistema, [O]
orienta, [Z] engata a queima brachistochrone (acelera até o meio, vira, desacelera —
3:00–6:00 min ∝ distância). No caminho: milhares de estrelas em PARALAXE crescente
com a velocidade, nebulosas, a nuvem do BULBO GALÁCTICO na direção de Sagitário A✦,
e os efeitos relativísticos REALISTAS no pico (aberração agrupando estrelas à frente,
Doppler azul/vermelho, beaming δ⁴). E a nave precisa SER VISÍVEL: jato de plasma
digno, luzes vermelhas nas asas, rim de reflexo.

## 2. Física de referência (brief 2026-07-04)

- **Brachistochrone:** a = 4D/T²; v_pico = √(D·a) = 2D/T; perfil normalizado
  x/D = 2s² (s≤½) e 1−2(1−s)² (s>½), s = t/T.
- **Aberração:** cos θ' = (cos θ − β)/(1 − β cos θ) — a 90° aparece em arccos β;
  o céu de trás esvazia ("headlight effect").
- **Doppler + beaming:** δ = 1/(γ(1−β cos θ')); corpo negro permanece corpo negro com
  T' = δ·T (recolorir pela temperatura, não por hue-shift); intensidade ∝ δ⁴ (clamp).
- **Starbow é MITO** (McKinley & Doherty 1979) — céu frontal azul-branco esparso.
- **Terrell–Penrose:** contração de comprimento NÃO é vista como achatamento — nada
  de escalar malhas por 1/γ; toda a relatividade vive no starfield/shading.
- **Direção do centro galáctico:** bulbo amarelo-quente (Grande Nuvem de Sagitário) +
  fendas de poeira (Great Rift) NA FRENTE; Sgr A* invisível no óptico (~30 mag de
  extinção) — nenhum ponto brilhante no centro.

## 3. Acceptance Criteria

- **AC-01 (fluxo T/O/Z):** com alvo de OUTRO sistema selecionado, [Z] engata a
  viagem (autopilot brachistochrone); [Z] em alvo do MESMO sistema mantém o toggle
  de assist (decisão do operador: Z contextual). [Z] de novo (ou [X]) aborta com
  velocidade residual segura. e2e prova engate, perfil e aborto.
- **AC-02 (perfil físico):** unit node do perfil: a = 4D/T², v(s) simétrico com pico
  em s=½, x(0)=0, x(T)=D (erro < 1%); desaceleração espelhada (v(s)=v(1−s)).
  T = clamp(k·D, 180 s, 360 s) — proporcional à distância entre sistemas.
- **AC-03 (corredor galáctico):** camada de starfield 3D em chunks com hash
  determinístico (recycling wrap-around), ≥ 2000 estrelas ativas em viagem, cores
  espectrais; PARALAXE real (posições 3D — as próximas passam rápido); nebulosas
  esparsas (Hα/O III/reflexão); fade-in fora dos sistemas / fade-out dentro.
  e2e: contagem de instâncias + recycling comprovado (chunks trocam com o movimento).
- **AC-04 (relatividade realista):** β_visual = v/v_pico_max ≤ 0.985; starfield com
  aberração pela fórmula real + recolor T'=δT + beaming δ⁴ (clamp); passe de tela
  leve p/ o skybox (convergência frontal + tint azul à frente/vermelho atrás).
  Efeito cresce até s=½ e desfaz simetricamente. e2e: uniforms variam com s.
- **AC-05 (bulbo galáctico):** skybox pinta o bulbo quente + fendas de poeira na
  DIREÇÃO do centro do sistema 'core' (sem ponto brilhante no Sgr A* — honesto);
  visível ao mirar [T] no core. e2e: pixels quentes na direção do core.
- **AC-06 (visibilidade da nave):** jato de plasma do motor (cone shader ∝ throttle,
  NormalBlending — gotcha NaN), 2 luzes VERMELHAS nas pontas das asas (emissivas,
  pulso sutil), rim/reflexo no casco. e2e: estruturas presentes no grafo da nave.
- **AC-07 (regressão):** suíte completa verde (smoke + campanha + física + journey);
  FPS floor mantido; aero intocado.

## 4. Não-escopo

Dilatação temporal jogável (relógios), Doppler no HUD, geração procedural de sistemas
visitáveis no corredor (as estrelas do corredor são cenário), Kerr/frame-dragging.

## 5. Write set

`space-war/src/**`, `tests/space-war/**`, `package.json` (scripts), esta pasta.
**Proibido:** `aero-fighters/**`, `tauan-trex/**`, `vendor/**`.
