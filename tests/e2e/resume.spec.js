const { test, expect, modalReady, openGame } = require('./fixtures');

const C = (s, r, up = true) => ({ s, r, up });
const back = page => page.getByRole('button', { name: /Retour au menu/ }).click();
const card = (page, name) => page.locator('.card', { hasText: name });

test('Démineur : la partie est reprise telle quelle (mines, drapeaux, difficulté)', async ({ page }) => {
  await openGame(page, 'Démineur');
  await page.selectOption('#diff', 'easy');
  await page.locator('.cell[data-r="4"][data-c="4"]').click();
  await page.locator('.cell[data-r="0"][data-c="0"]').click({ button: 'right' });
  const before = await page.evaluate(() => JSON.stringify({ m: [...msMines].sort((a, b) => a - b), r: msRevealed, f: msFlagged }));
  await back(page);                                                    // pas de confirmation : la partie est sauvegardée
  await expect(page.locator('#menu')).toBeVisible();
  await expect(card(page, 'Démineur').locator('[data-badge]')).toBeVisible();
  await card(page, 'Démineur').click();
  await expect(page.locator('.sc-toast')).toContainText('Partie reprise');
  expect(await page.evaluate(() => JSON.stringify({ m: [...msMines].sort((a, b) => a - b), r: msRevealed, f: msFlagged }))).toBe(before);
  await expect(page.locator('#diff')).toHaveValue('easy');
  // la partie reste jouable : on pose un drapeau sur une case encore cachée
  const [r, c] = await page.evaluate(() => { for (let r = 0; r < msCfg.rows; r++) for (let c = 0; c < msCfg.cols; c++) if (!msRevealed[r][c] && !msFlagged[r][c]) return [r, c]; });
  await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).click({ button: 'right' });
  await expect(page.locator(`.cell[data-r="${r}"][data-c="${c}"]`)).toHaveText('🚩');
});

test('Démineur : une partie terminée n\'est pas reprise', async ({ page }) => {
  await openGame(page, 'Démineur');
  await page.selectOption('#diff', 'easy');
  await page.locator('.cell[data-r="4"][data-c="4"]').click();
  await page.evaluate(() => { const [r, c] = [...msMines].map(i => [Math.floor(i / msCfg.cols), i % msCfg.cols])[0]; msClick(r, c); });
  await expect(page.locator('#msBanner')).toHaveClass(/lose/);
  await back(page);
  await expect(card(page, 'Démineur').locator('[data-badge]')).toBeHidden();
});

test('Solitaire : donne, coups, annulation possible et chrono sont repris', async ({ page }) => {
  await openGame(page, 'Solitaire');
  await page.locator('.sol-slot[data-zone="s"]').click();
  await page.waitForFunction(() => solElapsed >= 1);                 // le chrono tourne
  const before = await page.evaluate(() => JSON.stringify([sol.tab, sol.waste, sol.stock, sol.moves]));
  await page.keyboard.press('Escape');
  await card(page, 'Solitaire').click();
  expect(await page.evaluate(() => JSON.stringify([sol.tab, sol.waste, sol.stock, sol.moves]))).toBe(before);
  expect(await page.evaluate(() => solElapsed)).toBeGreaterThanOrEqual(1);
  await page.locator('#solUndo').click();                              // l'historique d'annulation est repris aussi
  expect(await page.evaluate(() => sol.moves)).toBe(0);
});

test('Solitaire : le mode de pioche est repris avec la partie', async ({ page }) => {
  await openGame(page, 'Solitaire');
  await page.selectOption('#solDraw', '3');
  await page.locator('.sol-slot[data-zone="s"]').click();
  await page.keyboard.press('Escape');
  await card(page, 'Solitaire').click();
  await expect(page.locator('#solDraw')).toHaveValue('3');
});

test('Solitaire : une complétion automatique interrompue reprend à la réouverture', async ({ page }) => {
  await openGame(page, 'Solitaire');
  const run = (s, n) => Array.from({ length: n }, (_, k) => C(s, k + 1));
  await page.evaluate(([a, b, c, d]) => {
    sol = { stock: [], waste: [], tab: [[...d].reverse(), [], [], [], [], [], []], found: [a, b, c, []], moves: 12, won: false, draw: 1 };
    solRender();
  }, [run(0, 13), run(1, 13), run(2, 13), run(3, 13).slice(8)]);
  await page.evaluate(() => { sol.found[3] = []; sol.tab[0] = []; for (let r = 13; r >= 1; r--) sol.tab[0].push({ s: 3, r, up: true }); });
  await page.keyboard.press('Escape');
  await card(page, 'Solitaire').click();
  await expect(page.locator('#solBanner')).toContainText('Bravo', { timeout: 15000 });
});

test('2048 : grille et score repris', async ({ page }) => {
  await openGame(page, '2048');
  await page.evaluate(() => { tfBoard = [[2, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 16]]; tfScore = 300; tfRender(); });
  await page.keyboard.press('ArrowLeft');                              // un coup valide pour démarrer vraiment la partie
  const before = await page.evaluate(() => JSON.stringify([tfBoard, tfScore]));
  await page.keyboard.press('Escape');
  await card(page, '2048').click();
  expect(await page.evaluate(() => JSON.stringify([tfBoard, tfScore]))).toBe(before);
  await expect(page.locator('#tfScore')).toHaveText(String(JSON.parse(before)[1]));
});

test('2048 : une grille bloquée n\'est pas reprise', async ({ page }) => {
  await openGame(page, '2048');
  await page.evaluate(() => { tfBoard = [[2, 4, 2, 4], [4, 2, 4, 2], [16, 32, 16, 32], [8, 2, 4, 0]]; tfScore = 100; tfRender(); });
  await page.keyboard.press('ArrowRight');                             // la grille se remplit et se bloque
  await modalReady(page);
  await page.keyboard.press('Escape');                                 // passer la saisie du score
  await page.keyboard.press('Escape');                                 // retour au menu
  await expect(card(page, '2048').locator('[data-badge]')).toBeHidden();
});

test('Wordle : essais joués, saisie en cours, clavier coloré et mot cible repris', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.keyboard.type('table');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !wdBusy);
  await page.keyboard.type('mai');
  const target = await page.evaluate(() => wdTarget);
  await page.keyboard.press('Escape');
  await card(page, 'Wordle').click();
  expect(await page.evaluate(() => wdTarget)).toBe(target);
  expect(await page.evaluate(() => [wdCurrentRow, wdCurrentCol])).toEqual([1, 3]);
  await expect(page.locator('#wdGrid .wd-row').first().locator('.wd-tile').first()).toHaveText('T');
  await expect(page.locator('#wdGrid .wd-tile.correct, #wdGrid .wd-tile.present, #wdGrid .wd-tile.absent').first()).toBeVisible();
  await expect(page.locator('.wd-key.absent, .wd-key.present, .wd-key.correct').first()).toBeVisible();
});

test('Wordle : la longueur de mot est reprise avec la partie', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.selectOption('#wdLen', '7');
  await page.keyboard.type('mus');
  await page.keyboard.press('Escape');
  await card(page, 'Wordle').click();
  await expect(page.locator('#wdLen')).toHaveValue('7');
  expect(await page.evaluate(() => wdLen)).toBe(7);
});

test('la sauvegarde se fait aussi quand on ferme ou recharge la page', async ({ page }) => {
  await openGame(page, '2048');
  await page.evaluate(() => { tfBoard = [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; tfScore = 50; tfRender(); });
  await page.keyboard.press('ArrowRight');
  await page.reload();
  await card(page, '2048').click();
  expect(await page.evaluate(() => tfScore)).toBe(50);
});

test('les cartes du menu comptent les parties et montrent le record du dernier niveau', async ({ page }) => {
  await page.goto('/');
  await expect(card(page, 'Snake').locator('[data-meta]')).toHaveText('Pas encore joué');
  await card(page, 'Snake').click();
  await page.selectOption('#snDiff', 'fast');
  await page.keyboard.press('ArrowUp');                                // première partie
  await page.evaluate(() => scAdd('snake', 'fast', 25, 'BST'));
  await page.keyboard.press('Space');                                  // pause, puis on quitte
  await back(page);
  await modalReady(page);
  await page.keyboard.press('Enter');
  await expect(card(page, 'Snake').locator('[data-meta]')).toHaveText('1 partie · 🏆 Difficile : 25 pts');
});
