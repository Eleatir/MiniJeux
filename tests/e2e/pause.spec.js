const { test, expect, modalReady, openGame } = require('./fixtures');

const overlay = page => page.locator('#pauseOverlay');
const pauseBtn = page => page.locator('#pauseBtn');

test('le bouton ⏸ est présent dans chaque jeu, avec un voile « Reprendre » qui cache la grille', async ({ page }) => {
  await page.goto('/');
  for (const game of ['Wordle', 'Démineur', 'Snake', 'Sudoku', 'Solitaire']) {
    await page.locator('.card', { hasText: game }).click();
    await expect(pauseBtn(page), game).toBeVisible();
    await pauseBtn(page).click();
    await expect(overlay(page), game).toBeVisible();
    await expect(pauseBtn(page)).toHaveText('▶');
    await expect(pauseBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await overlay(page).click();                                          // toucher le voile reprend
    await expect(overlay(page)).toHaveCount(0);
    await expect(pauseBtn(page)).toHaveText('⏸');
    await page.keyboard.press('Escape');
  }
});

test('Entrée, Espace ou P reprennent ; le clavier ne joue plus en pause', async ({ page }) => {
  await openGame(page, 'Wordle');
  await pauseBtn(page).click();
  await page.keyboard.type('abc');
  expect(await page.evaluate(() => wdCurrentCol)).toBe(0);               // rien n'a été tapé
  await expect(overlay(page)).toBeVisible();
  await page.keyboard.press('p');                                         // P reprend
  await expect(overlay(page)).toHaveCount(0);
  await pauseBtn(page).click();
  await page.keyboard.press('Enter');
  await expect(overlay(page)).toHaveCount(0);
  await pauseBtn(page).click();
  await page.keyboard.press('Space');
  await expect(overlay(page)).toHaveCount(0);
});

test('Wordle : le temps du score ne compte pas la pause', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.keyboard.type('t');
  await pauseBtn(page).click();
  const e1 = await page.evaluate(() => GAMES.wordle.save().elapsed);
  await page.waitForTimeout(1200);
  const e2 = await page.evaluate(() => GAMES.wordle.save().elapsed);
  expect(e2 - e1).toBeLessThan(100);                                      // gelé pendant la pause
  await overlay(page).click();
  await page.waitForTimeout(300);
  const e3 = await page.evaluate(() => GAMES.wordle.save().elapsed);
  expect(e3 - e2).toBeLessThan(900);                                      // la pause n'a pas été ajoutée au temps
});

test('Démineur : le chronomètre s\'arrête en pause et repart ensuite', async ({ page }) => {
  await openGame(page, 'Démineur');
  await page.selectOption('#diff', 'easy');
  await page.locator('.cell[data-r="4"][data-c="4"]').click();
  await page.waitForFunction(() => msElapsed >= 1);
  await pauseBtn(page).click();
  const t1 = await page.evaluate(() => msElapsed);
  await page.waitForTimeout(2200);
  expect(await page.evaluate(() => msElapsed)).toBe(t1);
  expect(await page.evaluate(() => GAMES.minesweeper.save().elapsed)).toBeLessThan((t1 + 2) * 1000);   // le temps de pause n'est pas compté
  await overlay(page).click();
  await page.waitForFunction(t => msElapsed > t, t1);
});

test('Sudoku et Solitaire : leurs chronos s\'arrêtent en pause', async ({ page }) => {
  await openGame(page, 'Sudoku');
  await page.evaluate(() => { const i = sd.puzzle.findIndex(v => !v); sdSelect(i); sdEnter(sd.solution[i]); });
  await page.waitForFunction(() => sd.elapsed >= 1);
  await pauseBtn(page).click();
  const t1 = await page.evaluate(() => sd.elapsed);
  await page.waitForTimeout(2200);
  expect(await page.evaluate(() => sd.elapsed)).toBe(t1);
  await overlay(page).click();
  await page.waitForFunction(t => sd.elapsed > t, t1);
  await page.keyboard.press('Escape');

  await page.locator('.card', { hasText: 'Solitaire' }).click();
  await page.locator('.sol-slot[data-zone="s"]').click();
  await page.waitForFunction(() => solElapsed >= 1);
  await pauseBtn(page).click();
  const s1 = await page.evaluate(() => solElapsed);
  await page.waitForTimeout(2200);
  expect(await page.evaluate(() => solElapsed)).toBe(s1);
  await overlay(page).click();
  await page.waitForFunction(t => solElapsed > t, s1);
});

test('Snake : le serpent s\'arrête en pause, Espace bascule la pause', async ({ page }) => {
  await openGame(page, 'Snake');
  await page.selectOption('#snDiff', 'slow');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect(overlay(page)).toBeVisible();
  const head = await page.evaluate(() => JSON.stringify(snBody[0]));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => JSON.stringify(snBody[0]))).toBe(head);
  await page.keyboard.press('Space');
  await expect(overlay(page)).toHaveCount(0);
  await page.waitForFunction(h => JSON.stringify(snBody[0]) !== h, head);
});

test('pas de pause quand la partie est terminée', async ({ page }) => {
  await openGame(page, 'Sudoku');
  await page.evaluate(() => { for (let i = 0; i < 81; i++) sd.grid[i] = sd.solution[i]; const k = sd.puzzle.findIndex(v => !v); sd.grid[k] = 0; sdSelect(k); sdEnter(sd.solution[k]); });
  await modalReady(page);
  await page.keyboard.press('Escape');                                    // passer la saisie du score
  await pauseBtn(page).click();
  await expect(overlay(page)).toHaveCount(0);
  await expect(pauseBtn(page)).toHaveText('⏸');
});

test('une fenêtre (scores, réglages) met le jeu en pause et le reprend à sa fermeture', async ({ page }) => {
  await openGame(page, 'Sudoku');
  await page.evaluate(() => { const i = sd.puzzle.findIndex(v => !v); sdSelect(i); sdEnter(sd.solution[i]); });
  await page.getByRole('button', { name: '🏆 Scores' }).click();
  await modalReady(page);
  expect(await page.evaluate(() => paused)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sc-panel')).toHaveCount(0);
  expect(await page.evaluate(() => paused)).toBe(false);                  // repris automatiquement
  await expect(overlay(page)).toHaveCount(0);
});

test('une pause demandée par le joueur le reste après la fermeture d\'une fenêtre', async ({ page }) => {
  await openGame(page, 'Solitaire');
  await pauseBtn(page).click();
  await page.getByRole('button', { name: '🏆 Scores' }).click({ force: true });
  await modalReady(page);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => paused)).toBe(true);
  await expect(overlay(page)).toBeVisible();
});

test('quitter le jeu lève la pause, et le jeu suivant démarre normalement', async ({ page }) => {
  await openGame(page, 'Wordle');
  await pauseBtn(page).click();
  await page.keyboard.press('Escape');
  await page.locator('.card', { hasText: 'Démineur' }).click();
  await expect(overlay(page)).toHaveCount(0);
  expect(await page.evaluate(() => paused)).toBe(false);
  await page.selectOption('#diff', 'easy');
  await page.locator('.cell[data-r="4"][data-c="4"]').click();
  expect(await page.evaluate(() => msStarted)).toBe(true);
});
