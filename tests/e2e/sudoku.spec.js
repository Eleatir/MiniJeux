const { test, expect, modalReady, openGame } = require('./fixtures');

const cell = (page, i) => page.locator(`.sd-cell[data-i="${i}"]`);
// Premières cases vides / données de la grille affichée
const emptyCell = (page, k = 0) => page.evaluate(k => sd.puzzle.map((v, i) => (v ? -1 : i)).filter(i => i >= 0)[k], k);
const givenCell = page => page.evaluate(() => sd.puzzle.findIndex(v => v));
// Une valeur fausse pour la case i (≠ solution), qui ne crée pas forcément de doublon
const wrongValue = (page, i) => page.evaluate(i => (sd.solution[i] % 9) + 1, i);

test.beforeEach(async ({ page }) => { await openGame(page, 'Sudoku'); });

test('une grille de 81 cases, avec le bon nombre d\'indices selon la difficulté', async ({ page }) => {
  await expect(page.locator('.sd-cell')).toHaveCount(81);
  for (const [level, givens] of [['easy', 40], ['medium', 32], ['hard', 26]]) {
    await page.selectOption('#sdLevel', level);
    const n = await page.locator('.sd-cell.given').count();
    expect(n).toBeGreaterThanOrEqual(givens);
    expect(n).toBeLessThanOrEqual(givens + 3);
  }
});

test('choisir une case teinte sa ligne, sa colonne, son bloc et les mêmes chiffres', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await expect(cell(page, i)).toHaveClass(/sel/);
  await expect(page.locator('.sd-cell.peer')).toHaveCount(20);          // ligne, colonne et bloc
  const g = await givenCell(page);
  await cell(page, g).click();
  const v = await page.evaluate(i => sd.grid[i], g);
  const same = await page.locator('.sd-cell.same').count();
  expect(same).toBe(await page.evaluate(v => sd.grid.filter(x => x === v).length, v));
});

test('on pose un chiffre au pavé ou au clavier, retaper le même chiffre l\'efface', async ({ page }) => {
  const i = await emptyCell(page);
  const v = await page.evaluate(i => sd.solution[i], i);
  await cell(page, i).click();
  await page.locator(`#sdPad [data-n="${v}"]`).click();
  await expect(cell(page, i)).toHaveText(String(v));
  await page.keyboard.press(String(v));
  await expect(cell(page, i)).toHaveText('');
  await page.keyboard.press(String(v));
  await expect(cell(page, i)).toHaveText(String(v));
  await page.keyboard.press('Backspace');
  await expect(cell(page, i)).toHaveText('');
});

test('une case de départ ne peut être ni modifiée ni effacée', async ({ page }) => {
  const g = await givenCell(page);
  const before = await page.evaluate(i => sd.grid[i], g);
  await cell(page, g).click();
  await page.keyboard.press(String(before % 9 + 1));
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(i => sd.grid[i], g)).toBe(before);
});

test('un chiffre faux est signalé en rouge tout de suite et compte une erreur', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.keyboard.press(String(await wrongValue(page, i)));
  await expect(cell(page, i)).toHaveClass(/bad/);
  await expect(page.locator('#sdErrors')).toHaveText('1/3');
  await page.keyboard.press('Backspace');
  await expect(cell(page, i)).not.toHaveClass(/bad/);
  await expect(page.locator('#sdErrors')).toHaveText('1/3');            // effacer ne rend pas l'erreur
  await page.keyboard.press(String(await page.evaluate(i => sd.solution[i], i)));
  await expect(cell(page, i)).not.toHaveClass(/bad/);                    // le bon chiffre ne coûte rien
  await expect(page.locator('#sdErrors')).toHaveText('1/3');
});

test('annuler un chiffre faux ne rend pas l\'erreur', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.keyboard.press(String(await wrongValue(page, i)));
  await page.keyboard.press('Control+z');
  await expect(page.locator('#sdErrors')).toHaveText('1/3');
});

test('trois erreurs : partie perdue, grille bloquée, aucun score, pas de reprise', async ({ page }) => {
  for (let k = 0; k < 3; k++) {
    const i = await emptyCell(page, k);
    await cell(page, i).click();
    await page.keyboard.press(String(await wrongValue(page, i)));
  }
  await expect(page.locator('#sdBanner')).toContainText('partie perdue');
  await expect(page.locator('#sdErrors')).toHaveText('3/3');
  const i4 = await emptyCell(page, 3);
  await cell(page, i4).click();
  await page.keyboard.press(String(await page.evaluate(i => sd.solution[i], i4)));
  expect(await page.evaluate(i => sd.grid[i], i4)).toBe(0);              // plus rien ne se pose
  await expect(page.locator('.sc-panel')).toHaveCount(0);                // pas de saisie de score
  await page.keyboard.press('Escape');
  await expect(page.locator('.card', { hasText: 'Sudoku' }).locator('[data-badge]')).toBeHidden();
  await page.locator('.card', { hasText: 'Sudoku' }).click();
  await expect(page.locator('#sdErrors')).toHaveText('0/3');             // nouvelle grille
});

test('les erreurs sont reprises avec la partie', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.keyboard.press(String(await wrongValue(page, i)));
  await page.keyboard.press('Escape');
  await page.locator('.card', { hasText: 'Sudoku' }).click();
  await expect(page.locator('#sdErrors')).toHaveText('1/3');
});

test('un indice ne compte jamais comme une erreur', async ({ page }) => {
  await page.locator('#sdTools [data-a="hint"]').click();
  await expect(page.locator('#sdErrors')).toHaveText('0/3');
  await expect(page.locator('#sdHints')).toHaveText('1');
});

test('fin automatique : quand plus aucune erreur n\'est possible, la grille se termine seule', async ({ page }) => {
  // on laisse trois cases vides, chacune sans ambiguïté possible une fois les autres remplies : on en remplit une, les deux dernières sont « forcées »
  await page.evaluate(() => {
    for (let i = 0; i < 81; i++) sd.grid[i] = sd.solution[i];
    sd.started = true; sd.elapsed = 42;
    const empties = [];                                                // trois cases vides qui ne se voient pas entre elles (la grille est tirée au hasard)
    for (let i = 0; i < 81 && empties.length < 3; i++) if (!sd.puzzle[i] && empties.every(e => !SD_PEERS[e].includes(i))) empties.push(i);
    empties.forEach(i => { sd.grid[i] = 0; });
    sdRender();
  });
  const empties = await page.evaluate(() => sd.grid.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0));
  expect(empties.length).toBe(3);
  await cell(page, empties[0]).click();
  await page.keyboard.press(String(await page.evaluate(i => sd.solution[i], empties[0])));
  await expect(page.locator('#sdBanner')).toContainText('Bravo', { timeout: 8000 });
  expect(await page.evaluate(() => sd.grid.every((v, i) => v === sd.solution[i]))).toBe(true);
  await modalReady(page);
  await expect(page.locator('.sc-big')).toHaveText('0:42');                // le chrono s'est arrêté au déclenchement
});

test('pas de fin automatique tant qu\'une case a encore plusieurs candidats', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.keyboard.press(String(await page.evaluate(i => sd.solution[i], i)));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => sd.auto || sd.won)).toBe(false);
});

test('la fin automatique ne se déclenche pas si un chiffre faux est encore posé', async ({ page }) => {
  await page.evaluate(() => {
    for (let i = 0; i < 81; i++) sd.grid[i] = sd.solution[i];
    const e = [...Array(81).keys()].filter(i => !sd.puzzle[i]).slice(0, 2);
    sd.grid[e[0]] = 0;                                                  // une case vide, …
    sd.grid[e[1]] = (sd.solution[e[1]] % 9) + 1;                        // … et un chiffre faux ailleurs
    sd.started = true; sdRender();
  });
  const e0 = await page.evaluate(() => sd.grid.findIndex((v, i) => !sd.puzzle[i] && v === 0));
  await cell(page, e0).click();
  await page.keyboard.press(String(await page.evaluate(i => sd.solution[i], e0)));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => sd.won)).toBe(false);                 // la case fausse reste à corriger
});

test('les flèches déplacent la sélection et restent dans la grille', async ({ page }) => {
  await cell(page, 0).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => sd.sel)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => sd.sel)).toBe(10);
});

test('notes : on note plusieurs chiffres, ils disparaissent des voisines quand on pose le chiffre', async ({ page }) => {
  const i = await emptyCell(page);
  const peer = await page.evaluate(i => SD_PEERS[i].find(k => !sd.puzzle[k]), i);
  const v = await page.evaluate(i => sd.solution[i], i);
  await page.keyboard.press('n');                                       // mode notes
  await expect(page.locator('#sdTools [data-a="notes"]')).toHaveClass(/on/);
  await cell(page, peer).click();
  await page.keyboard.press(String(v));
  await page.keyboard.press('9');
  expect(await page.evaluate(([p, v]) => (sd.notes[p] & (1 << v)) !== 0, [peer, v])).toBe(true);
  await expect(cell(page, peer).locator('.sd-notes')).toBeVisible();
  await page.keyboard.press('n');                                       // retour au mode normal
  await cell(page, i).click();
  await page.keyboard.press(String(v));
  expect(await page.evaluate(([p, v]) => (sd.notes[p] & (1 << v)) !== 0, [peer, v])).toBe(false);   // la note de la voisine a disparu
});

test('annuler (bouton et Ctrl+Z) revient en arrière pas à pas', async ({ page }) => {
  const [a, b] = [await emptyCell(page, 0), await emptyCell(page, 1)];
  await cell(page, a).click(); await page.keyboard.press('5');
  await cell(page, b).click(); await page.keyboard.press('6');
  await page.locator('#sdTools [data-a="undo"]').click();
  expect(await page.evaluate(([a, b]) => [sd.grid[a], sd.grid[b]], [a, b])).toEqual([5, 0]);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(a => sd.grid[a], a)).toBe(0);
});

test('l\'indice remplit la case choisie, compte une pénalité de 30 s', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.locator('#sdTools [data-a="hint"]').click();
  expect(await page.evaluate(i => sd.grid[i] === sd.solution[i], i)).toBe(true);
  await expect(page.locator('#sdHints')).toHaveText('1');
  expect(await page.evaluate(() => sdScore() - sd.elapsed)).toBe(30);
});

test('le pavé grise un chiffre quand il est posé 9 fois', async ({ page }) => {
  await page.evaluate(() => { for (let i = 0; i < 81; i++) if (sd.solution[i] === 3) sd.grid[i] = 3; sdRender(); });
  await expect(page.locator('#sdPad [data-n="3"]')).toHaveClass(/done/);
  await expect(page.locator('#sdPad [data-n="4"]')).not.toHaveClass(/done/);
});

test('terminer la grille : bannière, confettis, saisie du nom et record', async ({ page }) => {
  await page.evaluate(() => { for (let i = 0; i < 81; i++) sd.grid[i] = sd.solution[i]; sd.grid[sd.puzzle.findIndex(v => !v)] = 0; sdRender(); });
  const i = await emptyCell(page);
  const v = await page.evaluate(i => sd.solution[i], i);
  await cell(page, i).click();
  await page.locator(`#sdPad [data-n="${v}"]`).click();
  await expect(page.locator('#sdBanner')).toContainText('Bravo');
  await modalReady(page);
  await page.keyboard.type('sdk');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('SDK');
  await page.keyboard.press('Escape');
  await expect(page.locator('#sdBest')).not.toHaveText('—');
  await page.locator('#sdPad [data-n="1"]').click({ force: true });    // la partie est finie : plus rien ne bouge
  expect(await page.evaluate(() => sd.won)).toBe(true);
});

test('avec un indice, le score enregistré inclut la pénalité', async ({ page }) => {
  await page.evaluate(() => { for (let i = 0; i < 81; i++) sd.grid[i] = sd.solution[i]; const k = sd.puzzle.findIndex(v => !v); sd.grid[k] = 0; sd.hints = 2; sd.elapsed = 100; sd.started = true; sdRender(); });
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.keyboard.press(String(await page.evaluate(i => sd.solution[i], i)));
  await modalReady(page);
  await expect(page.locator('.sc-big')).toHaveText('2:40');             // 100 s + 2 × 30 s
});

test('nouvelle grille : confirmation si la partie a commencé', async ({ page }) => {
  const i = await emptyCell(page);
  await cell(page, i).click();
  await page.keyboard.press('5');
  await page.locator('#sdReset').click();
  await expect(page.locator('.sc-kicker')).toContainText('ABANDONNER');
  await modalReady(page);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(i => sd.grid[i], i)).toBe(5);
  await page.locator('#sdReset').click();
  await modalReady(page);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => sd.started)).toBe(false);
});
