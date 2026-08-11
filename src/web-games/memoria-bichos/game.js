const LEVELS = {
  6: { cards: 6, pairs: 3, columns: 3 },
  12: { cards: 12, pairs: 6, columns: 4 },
  20: { cards: 20, pairs: 10, columns: 5 },
};

const menuScreen = document.querySelector('[data-screen="menu"]');
const boardScreen = document.querySelector('[data-screen="board"]');
const board = document.querySelector('[data-board]');
const levelTitle = document.querySelector('[data-level-title]');
const cardCount = document.querySelector('[data-card-count]');

function setScreen(name) {
  menuScreen.hidden = name !== 'menu';
  boardScreen.hidden = name !== 'board';
}

function renderClosedBoard(level) {
  const config = LEVELS[level];
  board.innerHTML = '';
  board.style.setProperty('--columns', config.columns);
  levelTitle.textContent = `${config.cards} cartas`;
  cardCount.textContent = String(config.cards);

  for (let index = 0; index < config.cards; index += 1) {
    const card = document.createElement('button');
    card.className = 'memory-card';
    card.type = 'button';
    card.setAttribute('aria-label', `Carta fechada ${index + 1}`);
    card.dataset.state = 'closed';
    card.dataset.cardId = String(index + 1);
    card.innerHTML = '<span aria-hidden="true"></span>';
    board.append(card);
  }
}

document.querySelectorAll('[data-level]').forEach((button) => {
  button.addEventListener('click', () => {
    renderClosedBoard(button.dataset.level);
    setScreen('board');
  });
});

document.querySelector('[data-action="menu"]').addEventListener('click', () => {
  setScreen('menu');
});
