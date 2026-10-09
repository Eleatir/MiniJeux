const { test, expect, modalReady, openGame } = require('./fixtures');

// Écrit la solution d'un mot (par indices de cases) dans la grille, comme le ferait le joueur
const solveWord = (page, si) => page.evaluate(i => { const s = mf.slots[i]; mfPickSlot(i); s.cells.forEach(c => { mf.sel = c; mfType(mf.sol[c]); }); }, si);
const solveAll = page => page.evaluate(() => { mf.slots.forEach((s, si) => { mfPickSlot(si); s.cells.forEach(c => { mf.sel = c; mfType(mf.sol[c]); }); }); });

test('la grille s\'affiche avec ses définitions et une case déjà choisie', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  await expect(page.locator('#mfGrid .mf-clue').first()).toBeVisible();
  expect(await page.locator('#mfGrid .mf-cell').count()).toBeGreaterThan(25);
  await expect(page.locator('#mfClue')).toContainText('(');          // définition + nombre de lettres
  await expect(page.locator('#mfGrid .mf-cell.sel')).toHaveCount(1);
  await expect(page.locator('#mfGrid .mf-cell.word').first()).toBeVisible();
});

test('au clavier : les lettres s\'écrivent et le curseur avance dans le mot, accents ignorés', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  const s = await page.evaluate(() => { const sl = mf.slots[mfActive()]; return { cells: sl.cells, first: sl.cells[0], sol: sl.cells.map(c => mf.sol[c]) }; });
  await page.keyboard.type(s.sol[0].toLowerCase());
  await expect(page.locator(`#mfGrid .mf-cell[data-i="${s.cells[0]}"]`)).toHaveText(s.sol[0]);
  expect(await page.evaluate(() => mf.sel)).toBe(s.cells[1]);                     // le curseur a avancé
  await page.keyboard.press('Backspace');                                          // case vide : recule et efface
  expect(await page.evaluate(() => mf.sel)).toBe(s.cells[0]);
  await expect(page.locator(`#mfGrid .mf-cell[data-i="${s.cells[0]}"]`)).toHaveText('');
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'é', bubbles: true })));   // clavier français : é
  await expect(page.locator(`#mfGrid .mf-cell[data-i="${s.cells[0]}"]`)).toHaveText('E');
});

test('toucher une définition place le curseur sur le début de son mot ; Espace change de sens', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  const target = await page.evaluate(() => { const si = mf.slots.length - 1; return { si, first: mf.slots[si].cells[0], dir: mf.slots[si].dir }; });
  await page.locator(`#mfGrid [data-slot="${target.si}"]`).click();
  expect(await page.evaluate(() => mf.sel)).toBe(target.first);
  expect(await page.evaluate(() => mf.dir)).toBe(target.dir);
  // une case qui appartient à deux mots : Espace alterne
  const cross = await page.evaluate(() => mf.at.findIndex(a => a.h >= 0 && a.v >= 0));
  await page.locator(`#mfGrid .mf-cell[data-i="${cross}"]`).click();
  const d1 = await page.evaluate(() => mf.dir);
  await page.keyboard.press(' ');
  expect(await page.evaluate(() => mf.dir)).not.toBe(d1);
});

test('Vérifier marque les lettres fausses (+20 s) ; les corriger enlève la marque', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  const i = await page.evaluate(() => { const c = mf.slots[0].cells[0]; mf.sel = c; mf.dir = mf.slots[0].dir; mfType(mf.sol[c] === 'Z' ? 'Y' : 'Z'); return c; });
  await page.locator('#mfTools [data-a="check"]').click();
  await expect(page.locator(`#mfGrid .mf-cell[data-i="${i}"]`)).toHaveClass(/bad/);
  await expect(page.locator('.sc-toast').last()).toContainText('lettre fausse');
  expect(await page.evaluate(() => mf.pen)).toBe(20);
  await page.evaluate(i => { mf.sel = i; mfType(mf.sol[i]); }, i);
  await expect(page.locator(`#mfGrid .mf-cell[data-i="${i}"]`)).not.toHaveClass(/bad/);
});

test('les aides révèlent une lettre (+15 s) ou un mot (+45 s) ; une lettre révélée ne se modifie plus', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  await page.locator('#mfTools [data-a="letter"]').click();
  const r = await page.evaluate(() => ({ pen: mf.pen, i: mf.sel, rev: mf.rev[mf.sel], ok: mf.grid[mf.sel] === mf.sol[mf.sel] }));
  expect(r).toMatchObject({ pen: 15, rev: 1, ok: true });
  await page.keyboard.type(r.ok ? (await page.evaluate(i => mf.sol[i] === 'Q' ? 'W' : 'Q', r.i)) : 'Q');
  expect(await page.evaluate(i => mf.grid[i] === mf.sol[i], r.i)).toBe(true);
  await page.locator('#mfTools [data-a="word"]').click();
  expect(await page.evaluate(() => mf.pen)).toBe(60);
  expect(await page.evaluate(() => { const s = mf.slots[mfActive()]; return s.cells.every(c => mf.grid[c] === mf.sol[c]); })).toBe(true);
  await expect(page.locator('#mfHints')).toHaveText('2');
});

test('terminer la grille : victoire, score avec les aides, nom en 3 lettres, record affiché', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  await page.locator('#mfTools [data-a="letter"]').click();                         // +15 s
  await solveAll(page);
  await expect(page.locator('#mfBanner')).toContainText('Bravo');
  await expect(page.locator('#mfBanner')).toContainText('15 s d\'aides');
  await modalReady(page);
  await expect(page.locator('.sc-kicker')).toContainText('NOUVEAU SCORE');
  await page.keyboard.type('mot');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('MOT');
  await page.keyboard.press('Escape');
  await expect(page.locator('#mfBest')).not.toHaveText('—');
});

test('une grille en cours est reprise (lettres, aides, temps) ; une grille terminée ne l\'est pas', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  await solveWord(page, 0);
  await page.locator('#mfTools [data-a="letter"]').click();
  await page.waitForFunction(() => mf.elapsed >= 1);
  const before = await page.evaluate(() => ({ grid: mf.grid.join(''), sol: mf.sol.join(''), pen: mf.pen }));
  await page.keyboard.press('Escape');
  await expect(page.locator('.card', { hasText: 'Mots fléchés' }).locator('[data-badge]')).toBeVisible();
  await page.locator('.card', { hasText: 'Mots fléchés' }).click();
  const after = await page.evaluate(() => ({ grid: mf.grid.join(''), sol: mf.sol.join(''), pen: mf.pen, el: mf.elapsed }));
  expect(after.grid).toBe(before.grid); expect(after.sol).toBe(before.sol); expect(after.pen).toBe(before.pen);
  expect(after.el).toBeGreaterThanOrEqual(1);
  await solveAll(page);
  await modalReady(page); await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('.card', { hasText: 'Mots fléchés' }).locator('[data-badge]')).toBeHidden();
});

test('le niveau se change avec confirmation et donne une autre taille de grille', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  await page.selectOption('#mfLevel', 'small');            // aucune partie commencée : pas de confirmation
  expect(await page.evaluate(() => [mf.rows, mf.cols])).toEqual([7, 6]);
  await page.selectOption('#mfLevel', 'large');
  expect(await page.evaluate(() => [mf.rows, mf.cols])).toEqual([9, 8]);
});

test('le chrono s\'arrête en pause', async ({ page }) => {
  await openGame(page, 'Mots fléchés');
  await page.keyboard.type('a');
  await page.waitForFunction(() => mf.elapsed >= 1);
  await page.locator('#pauseBtn').click();
  const t1 = await page.evaluate(() => mf.elapsed);
  await page.waitForTimeout(2200);
  expect(await page.evaluate(() => mf.elapsed)).toBe(t1);
  await page.locator('#pauseOverlay').click();
  await page.waitForFunction(t => mf.elapsed > t, t1);
});
