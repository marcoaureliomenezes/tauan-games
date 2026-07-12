const { test, expect } = require('@playwright/test');

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

function collectRuntimeProblems(page) {
  const problems = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    problems.push(`page error: ${error.message}`);
  });

  page.on('request', (request) => {
    const url = new URL(request.url());
    const isExternal =
      EXTERNAL_PROTOCOLS.has(url.protocol) &&
      !['localhost', '127.0.0.1'].includes(url.hostname);

    if (isExternal) {
      problems.push(`external request: ${request.url()}`);
    }
  });

  return problems;
}

test.describe('Memoria dos Bichos — smoke e navegacao inicial', () => {
  test('abre o jogo em servidor estatico sem erros, build ou rede externa', async ({ page }) => {
    const problems = collectRuntimeProblems(page);

    await page.goto('/memoria-bichos/');

    await expect(page).toHaveTitle('Memoria dos Bichos');
    await expect(page.getByRole('heading', { name: 'Memoria dos Bichos' })).toBeVisible();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(page.locator('[data-screen="board"]')).toBeHidden();
    await expect(page.getByRole('button', { name: /6 cartas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /12 cartas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /20 cartas/i })).toBeVisible();
    await expect(page.locator('script[src="game.js"]')).toHaveCount(1);
    await expect(page.locator('link[rel="stylesheet"][href="styles.css"]')).toHaveCount(1);

    expect(problems).toEqual([]);
  });

  test('catalogo principal navega para a pagina do jogo', async ({ page }) => {
    const problems = collectRuntimeProblems(page);

    await page.goto('/');

    const gameLink = page.getByRole('link', { name: /Memoria dos Bichos/i });
    await expect(gameLink).toBeVisible();
    await expect(gameLink).toHaveAttribute('href', 'memoria-bichos/');

    await gameLink.click();

    await expect(page).toHaveURL(/\/memoria-bichos\/$/);
    await expect(page.getByRole('heading', { name: 'Memoria dos Bichos' })).toBeVisible();
    await expect(page.getByRole('button', { name: /6 cartas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /12 cartas/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /20 cartas/i })).toBeVisible();

    expect(problems).toEqual([]);
  });

  test('os tres controles de nivel iniciam a primeira grade fechada', async ({ page }) => {
    const problems = collectRuntimeProblems(page);

    for (const cards of [6, 12, 20]) {
      await page.goto('/memoria-bichos/');

      await page.getByRole('button', { name: new RegExp(`${cards} cartas`, 'i') }).click();

      await expect(page.locator('[data-screen="board"]')).toBeVisible();
      await expect(page.locator('[data-screen="menu"]')).toBeHidden();
      await expect(page.locator('[data-level-title]')).toHaveText(`${cards} cartas`);
      await expect(page.locator('[data-card-count]')).toHaveText(String(cards));
      await expect(page.locator('[data-board] .memory-card')).toHaveCount(cards);
      await expect(page.locator('[data-board] .memory-card[data-state="closed"]')).toHaveCount(cards);
      await expect(page.locator('[data-board] .memory-card').first()).toHaveAttribute('data-card-id', '1');
    }

    expect(problems).toEqual([]);
  });
});
