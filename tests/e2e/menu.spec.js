const { test, expect, modalReady, openGame } = require('./fixtures');

test('le menu propose les cinq jeux et chacun démarre', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mini-jeux');
  await expect(page.locator('.card[data-game]')).toHaveCount(5);
  for (const [game, title] of [['Wordle', 'Wordle'], ['Démineur', 'Démineur'], ['Snake', 'Snake'], ['Sudoku', 'Sudoku'], ['Solitaire', 'Solitaire']]) {
    await page.locator('.card', { hasText: game }).click();
    await expect(page).toHaveTitle('Mini-jeux — ' + title);
    await expect(page.locator('#game-shell')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).toBeVisible();
  }
});

test('le message d\'accueil s\'affiche une seule fois', async ({ browser }) => {
  const context = await browser.newContext();   // sans le script qui masque l'accueil
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.sc-kicker')).toContainText('BIENVENUE');
  await modalReady(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-panel')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.sc-panel')).toHaveCount(0);
  await context.close();
});

test('les règles s\'ouvrent la première fois puis restent repliées', async ({ page }) => {
  await openGame(page, 'Démineur');
  await expect(page.locator('details.rules')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await page.locator('.card', { hasText: 'Démineur' }).click();
  await expect(page.locator('details.rules')).not.toHaveAttribute('open', '');
});

test('les cartes du menu sont utilisables au clavier', async ({ page }) => {
  await page.goto('/');
  await page.locator('.card', { hasText: 'Sudoku' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sdGrid')).toBeVisible();
});

test('les réglages se règlent au clavier et sont mémorisés', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⚙ Réglages' }).click();
  await modalReady(page);
  await page.keyboard.press('Space');                       // sons : oui
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');                       // contraste élevé : oui
  await expect(page.locator('html')).toHaveClass(/hc/);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/hc/);
  expect(await page.evaluate(() => Settings.get('sound'))).toBe(true);
});

test('l\'export puis l\'import des scores fonctionnent, un fichier invalide est refusé', async ({ page }) => {
  // dossier temporaire à chemin ASCII : certains environnements ne gèrent pas les accents dans les chemins de fichiers envoyés au navigateur
  const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'minijeux-'));
  await page.goto('/');
  await page.evaluate(() => scAdd('snake', 'medium', 77, 'EXP'));
  await page.getByRole('button', { name: '⚙ Réglages' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-a="export"]').click()]);
  const file = require('path').join(dir, 'scores.json');
  await download.saveAs(file);
  expect(download.suggestedFilename()).toBe('minijeux-scores.json');

  await page.evaluate(() => { scLoad(); scData = {}; scSave(); });
  expect(await page.evaluate(() => scList('snake', 'medium').length)).toBe(0);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-a="import"]').click()]);
  await chooser.setFiles(file);
  await expect(page.locator('.sc-toast')).toContainText('1 score importé');
  expect(await page.evaluate(() => scList('snake', 'medium').map(e => e.n + e.v))).toEqual(['EXP77']);

  const bad = require('path').join(dir, 'bad.json');
  require('fs').writeFileSync(bad, '{"x":1}');
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-a="import"]').click()]);
  await chooser2.setFiles(bad);
  await expect(page.locator('.sc-toast').last()).toContainText('invalide');
});

test('saisie d\'un nom de 3 lettres puis tableau des scores avec la ligne en surbrillance', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => scSubmit('snake', 'medium', 42));
  await modalReady(page);
  await page.keyboard.type('zed');
  await expect(page.locator('.sc-letter')).toHaveText(['Z', 'E', 'D']);
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('ZED');
  await expect(page.locator('.sc-row.hi')).toContainText('42 pts');
  expect(await page.evaluate(() => localStorage.getItem('minijeux.name'))).toBe('ZED');
});

test('les touches de la fenêtre de score ne se transmettent pas au jeu', async ({ page }) => {
  await openGame(page, 'Snake');
  await page.evaluate(() => scSubmit('snake', 'medium', 10));
  await modalReady(page);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => snRunning)).toBe(false);   // le Snake n'a pas démarré
});

test('Échap n\'ouvre pas deux fois la confirmation et ferme d\'abord la fenêtre', async ({ page }) => {
  await openGame(page, 'Snake');
  await page.keyboard.press('ArrowUp');                         // le serpent démarre
  await page.keyboard.press('Escape');                          // confirmation « quitter »
  await expect(page.locator('.sc-kicker')).toContainText('QUITTER');
  await modalReady(page);
  await page.keyboard.press('Escape');                          // annule
  await expect(page.locator('.sc-panel')).toHaveCount(0);
  await expect(page.locator('#game-shell')).toBeVisible();
  await page.keyboard.press('Escape');
  await modalReady(page);
  await page.keyboard.press('Enter');                           // confirme
  await expect(page.locator('#menu')).toBeVisible();
});
