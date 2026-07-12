# Corrida

Corrida e um jogo 2D top-down feito para abrir direto no navegador. O objetivo e
completar uma corrida curta, passar pelos checkpoints na ordem certa e ver o resultado
final com tempo e posicao.

## Como Rodar

Na raiz do repositorio, sirva os arquivos estaticos:

```bash
python3 -m http.server 8080
```

Depois abra:

```text
http://localhost:8080/corrida/
```

Tambem funciona em qualquer servidor estatico, sem build step.

## Controles

- Acelerar: seta para cima ou `W`
- Frear/re: seta para baixo ou `S`
- Estercar: setas esquerda/direita ou `A`/`D`
- Iniciar a corrida: `Espaco`
- Reiniciar: `R`

## Objetivo

Complete 3 voltas antes dos adversarios. A pista tem largada/chegada, checkpoints,
fora de pista com reducao de velocidade e 3 adversarios controlados por IA simples.
