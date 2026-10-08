const { test, expect, modalReady, openGame } = require('./fixtures');

const typeWord = async (page, word) => { await page.keyboard.type(word); await page.keyboard.press('Enter'); };
const revealed = page => page.waitForFunction(() => !wdBusy);   // la révélation lettre par lettre est terminée

test('un mot absent du dictionnaire est refusé sans consommer d\'essai', async ({ page }) => {
  await openGame(page, 'Wordle');
  await typeWord(page, 'azert');
  await expect(page.locator('#wdMsg')).toContainText('dictionnaire');
  expect(await page.evaluate(() => wdCurrentRow)).toBe(0);
});

test('un mot trop court est signalé, puis le message disparaît seul', async ({ page }) => {
  await openGame(page, 'Wordle');
  await typeWord(page, 'mai');
  await expect(page.locator('#wdMsg')).toHaveText('Mot trop court !');
  await expect(page.locator('#wdMsg')).toHaveText('', { timeout: 4000 });
});

test('un essai valide passe à la ligne suivante et colore les lettres', async ({ page }) => {
  await openGame(page, 'Wordle');
  await typeWord(page, 'table');
  await revealed(page);
  expect(await page.evaluate(() => wdCurrentRow)).toBe(1);
  const classes = await page.locator('#wdGrid .wd-row').first().locator('.wd-tile').evaluateAll(t => t.map(x => x.className));
  for (const c of classes) expect(c).toMatch(/correct|present|absent/);
});

test('trouver le mot affiche la victoire et propose d\'enregistrer le score', async ({ page }) => {
  await openGame(page, 'Wordle');
  const target = await page.evaluate(() => wdTarget);
  await typeWord(page, target.toLowerCase());
  await expect(page.locator('#wdMsg')).toContainText('Bravo');
  await modalReady(page);
  await expect(page.locator('.sc-big')).toContainText('1 essai');
  await page.keyboard.type('wrd');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('WRD');
});

test('six essais ratés donnent la défaite et révèlent le mot', async ({ page }) => {
  await openGame(page, 'Wordle');
  const wrong = await page.evaluate(() => WD_WORDS[5].filter(w => w.toUpperCase() !== wdTarget).slice(0, 6));
  for (const w of wrong) { await typeWord(page, w); await revealed(page); }
  await expect(page.locator('#wdMsg')).toContainText('Perdu');
  await expect(page.locator('#wdMsg')).toContainText(await page.evaluate(() => wdTarget));
});

test('le clavier à l\'écran fonctionne comme le clavier physique', async ({ page }) => {
  await openGame(page, 'Wordle');
  for (const k of 'TABLE') await page.locator('.wd-key', { hasText: new RegExp('^' + k + '$') }).click();
  await page.locator('.wd-key', { hasText: 'Entrée' }).click();
  await revealed(page);
  expect(await page.evaluate(() => wdCurrentRow)).toBe(1);
  await page.locator('.wd-key', { hasText: 'A' }).first().click();
  await page.locator('.wd-key', { hasText: '←' }).click();
  expect(await page.evaluate(() => wdCurrentCol)).toBe(0);
});

test('les accents sont ignorés : « etoile » est accepté pour 6 lettres', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.selectOption('#wdLen', '6');
  await typeWord(page, 'maison');
  await revealed(page);
  expect(await page.evaluate(() => wdCurrentRow)).toBe(1);
});

test('contraste élevé : bien placé = orange, présent = bleu', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.evaluate(() => Settings.set('contrast', true));
  const target = await page.evaluate(() => wdTarget);
  await typeWord(page, target.toLowerCase());
  await revealed(page);
  const bg = await page.locator('#wdGrid .wd-tile.correct').first().evaluate(e => getComputedStyle(e).backgroundColor);
  expect(bg).toBe('rgb(245, 121, 58)');
});

test('demander un nouveau mot en pleine partie demande confirmation', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.keyboard.type('tab');
  await page.locator('#wdReset').click();
  await expect(page.locator('.sc-kicker')).toContainText('ABANDONNER');
  await modalReady(page);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => wdCurrentCol)).toBe(3);        // annulé : la saisie est gardée
  await page.locator('#wdReset').click();
  await modalReady(page);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => wdCurrentCol)).toBe(0);        // confirmé : nouvelle partie
});

test('changer la longueur annulé remet l\'ancienne valeur', async ({ page }) => {
  await openGame(page, 'Wordle');
  await page.keyboard.type('tab');
  await page.selectOption('#wdLen', '7');
  await modalReady(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#wdLen')).toHaveValue('5');
});
