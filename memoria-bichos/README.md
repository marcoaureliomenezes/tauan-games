# Memoria dos Bichos

Jogo de memoria infantil em HTML, CSS e JavaScript puro. A crianca escolhe um nivel e
encontra pares de animais virando cartas por clique ou toque.

## Como rodar

Na raiz do repositorio, suba um servidor estatico:

```bash
python3 -m http.server 8080
```

Depois abra:

```text
http://localhost:8080/memoria-bichos/
```

Nao ha build step, CDN, backend ou chamada de rede em runtime.

## Objetivo

Encontrar todos os pares de animais. Esta primeira fatia cria a tela inicial, os tres
niveis e a grade inicial de cartas fechadas para o nivel escolhido.

## Niveis

- 6 cartas, com 3 pares.
- 12 cartas, com 6 pares.
- 20 cartas, com 10 pares.

## Controles

- Clique ou toque em um dos tres botoes grandes para iniciar o nivel.
- Use o botao de seta para voltar para a escolha de nivel.
