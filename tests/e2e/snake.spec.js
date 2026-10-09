const { test, expect, modalReady, openGame } = require('./fixtures');

test.beforeEach(async ({ page }) => {
  await openGame(page, 'Snake');
  await page.selectOption('#snDiff', 'slow');
});

test('la première touche lance la partie', async ({ page }) => {
  expect(await page.evaluate(() => snRunning)).toBe(false);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => snRunning)).toBe(true);
  await expect(page.locator('#snOverlay')).toBeHidden();
});

test('démarrer vers la gauche est ignoré (le corps est à gauche : mort immédiate)', async ({ page }) => {
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => snRunning)).toBe(false);
});

test('le serpent avance, et traverse les murs', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  const y0 = await page.evaluate(() => snBody[0].y);
  await page.waitForFunction(y => snBody[0].y !== y, y0);
  await page.evaluate(() => { snBody[0] = { x: 10, y: 0 }; snBody[1] = { x: 10, y: 1 }; snBody[2] = { x: 10, y: 2 }; snDir = 'U'; });
  await page.waitForFunction(() => snBody[0].y === 19);                // ressorti en bas
});

test('manger une pomme augmente le score', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.evaluate(() => { const h = snBody[0]; snFood = { x: h.x, y: (h.y + SN_ROWS - 1) % SN_ROWS }; snDir = 'U'; });
  await expect(page.locator('#snScore')).toHaveText('1', { timeout: 4000 });
});

test('Espace met en pause et reprend, la pause bloque les directions', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => snPaused)).toBe(true);
  await expect(page.locator('#pauseOverlay')).toContainText('Pause');
  const head = await page.evaluate(() => JSON.stringify(snBody[0]));
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => snQueue.length)).toBe(0);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.stringify(snBody[0]))).toBe(head);   // immobile
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => snPaused)).toBe(false);
});

test('la pause est automatique quand la fenêtre perd le focus', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => snPaused)).toBe(true);
});

test('deux directions rapides ne se perdent pas, le demi-tour est interdit', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.evaluate(() => clearInterval(snLoop));                  // on fige les ticks : seule la file de directions est testée
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');                             // demi-tour par rapport à ← : refusé
  expect(await page.evaluate(() => snQueue.join())).toBe('L');
  await page.keyboard.press('ArrowDown');                              // ↓ après ← : un virage valide, retenu aussi
  expect(await page.evaluate(() => snQueue.join())).toBe('L,D');
});

test('se mordre met fin à la partie et propose d\'enregistrer le score', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.evaluate(() => {
    snScore = 12;
    const h = snBody[0];
    snBody = [h, { x: h.x - 1, y: h.y }, { x: h.x - 1, y: h.y - 1 }, { x: h.x, y: h.y - 1 }];   // la tête va droit dans son corps (↑)
    snDir = 'U'; snQueue = [];
  });
  await modalReady(page);
  await expect(page.locator('.sc-big')).toHaveText('12 pts');
  await page.keyboard.type('snk');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('SNK');
});

test('le record du niveau s\'affiche au lancement', async ({ page }) => {
  await page.evaluate(() => scAdd('snake', 'slow', 33, 'REC'));
  await page.selectOption('#snDiff', 'medium');
  await page.selectOption('#snDiff', 'slow');
  await expect(page.locator('#snBest')).toHaveText('33');
});

test('quitter en pleine partie demande confirmation (le Snake ne se sauvegarde pas)', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: /Retour au menu/ }).click();
  await expect(page.locator('.sc-kicker')).toContainText('QUITTER');
  expect(await page.evaluate(() => snPaused)).toBe(true);              // la fenêtre met le jeu en pause
});
