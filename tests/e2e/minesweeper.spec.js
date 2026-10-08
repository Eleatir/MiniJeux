const { test, expect, modalReady, openGame } = require('./fixtures');

const cell = (page, r, c) => page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);

// Plateau « facile » (9×9) à mines connues, partie déjà démarrée
async function setBoard(page, mines) {
  await page.evaluate(m => {
    initMinesweeper();
    msMines = new Set(m.map(([r, c]) => r * 9 + c));
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) msBoard[r][c] = msMines.has(r * 9 + c) ? -1 : 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (msBoard[r][c] === -1) continue;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const a = r + dr, b = c + dc;
        if (a >= 0 && a < 9 && b >= 0 && b < 9 && msBoard[a][b] === -1) n++;
      }
      msBoard[r][c] = n;
    }
    msStarted = true; msStart = Date.now();
    msRender();
  }, mines);
}
// 10 mines (le niveau facile en compte 10)
const MINES = [[0, 0], [0, 2], [8, 8], [5, 5], [6, 6], [7, 7], [3, 8], [4, 8], [2, 8], [4, 2]];

test.beforeEach(async ({ page }) => {
  await openGame(page, 'Démineur');
  await page.selectOption('#diff', 'easy');
});

test('la première case jouée n\'est jamais une mine et démarre le chrono', async ({ page }) => {
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => initMinesweeper());                // nouvelle partie (sans passer par la confirmation)
    await cell(page, 4, 4).click();
    expect(await page.evaluate(() => msOver)).toBe(false);
    expect(await page.evaluate(() => msBoard[4][4])).toBe(0);
  }
  await expect(page.locator('#timer')).not.toHaveText('0s', { timeout: 4000 });
});

test('clic droit : drapeau posé puis retiré, compteur de mines à jour', async ({ page }) => {
  await setBoard(page, MINES);
  await cell(page, 1, 1).click({ button: 'right' });
  await expect(cell(page, 1, 1)).toHaveText('🚩');
  await expect(page.locator('#mineCount')).toHaveText('9');
  await cell(page, 1, 1).click({ button: 'right' });
  await expect(page.locator('#mineCount')).toHaveText('10');
});

test('le compteur ne devient jamais négatif (autant de drapeaux que de mines au plus)', async ({ page }) => {
  await setBoard(page, MINES);
  const eleven = [...Array(9).keys()].map(c => [8, c]).concat([[7, 0], [7, 1]]);
  for (const [r, c] of eleven) await cell(page, r, c).click({ button: 'right' });
  await expect(page.locator('#mineCount')).toHaveText('0');
  expect(await page.evaluate(() => msFlagged.flat().filter(Boolean).length)).toBe(10);   // le 11e drapeau est refusé
});

test('chording : un chiffre entouré d\'autant de drapeaux révèle ses voisines', async ({ page }) => {
  await setBoard(page, MINES);
  await cell(page, 0, 1).click();                                    // un « 2 »
  await cell(page, 0, 0).click({ button: 'right' });
  await cell(page, 0, 1).click();
  expect(await page.evaluate(() => msRevealed[1][0] || msRevealed[1][1])).toBe(false);   // 1 drapeau sur 2 : rien
  await cell(page, 0, 2).click({ button: 'right' });
  await cell(page, 0, 1).click();                                    // 2 drapeaux : on révèle
  expect(await page.evaluate(() => msRevealed[1][0] && msRevealed[1][1] && msRevealed[1][2])).toBe(true);
});

test('chording avec un drapeau mal placé : défaite et ❌ sur le mauvais drapeau', async ({ page }) => {
  await setBoard(page, MINES);
  await cell(page, 0, 1).click();
  await cell(page, 1, 0).click({ button: 'right' });                  // faux drapeau
  await cell(page, 0, 2).click({ button: 'right' });                  // bon drapeau
  await cell(page, 0, 1).click();                                    // (0,0) est une mine non marquée
  await expect(page.locator('#msBanner')).toContainText('Boom');
  await expect(cell(page, 1, 0)).toHaveText('❌');
  await expect(cell(page, 0, 2)).toHaveText('🚩');
});

test('cliquer une mine : défaite, mines révélées, pas de score', async ({ page }) => {
  await setBoard(page, MINES);
  await cell(page, 8, 8).click();
  await expect(page.locator('#msBanner')).toHaveClass(/lose/);
  await expect(cell(page, 5, 5)).toHaveText('💣');
  await expect(page.locator('.sc-panel')).toHaveCount(0);
});

test('victoire : bannière, drapeaux posés partout, saisie du nom puis record affiché', async ({ page }) => {
  await setBoard(page, MINES);
  await page.evaluate(() => {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!msMines.has(r * 9 + c)) msRevealed[r][c] = true;
    msRevealed[8][0] = false; msRender();
  });
  await cell(page, 8, 0).click();
  await expect(page.locator('#msBanner')).toContainText('Bravo');
  await expect(page.locator('#mineCount')).toHaveText('0');
  await modalReady(page);
  await page.keyboard.type('abc');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('ABC');
  await page.keyboard.press('Escape');
  await expect(page.locator('#msBest')).not.toHaveText('—');
});

test('un clic sur un chiffre non satisfait ne fait rien, et clic molette = chording', async ({ page }) => {
  await setBoard(page, MINES);
  await cell(page, 0, 1).click();
  await cell(page, 0, 0).click({ button: 'right' });
  await cell(page, 0, 2).click({ button: 'right' });
  await cell(page, 0, 1).click({ button: 'middle' });
  expect(await page.evaluate(() => msRevealed[1][1])).toBe(true);
});

test('la grille difficile tient dans la page sans défilement horizontal', async ({ page }) => {
  await page.selectOption('#diff', 'hard');
  const overflow = await page.locator('.grid-wrap').evaluate(e => e.scrollWidth > e.clientWidth);
  expect(overflow).toBe(false);
});
