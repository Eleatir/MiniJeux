const { test, expect, modalReady, openGame } = require('./fixtures');

const setBoard = (page, board, score = 0) => page.evaluate(([b, sc]) => { tfBoard = b; tfScore = sc; tfNew = -1; tfRender(); }, [board, score]);
const board = page => page.evaluate(() => tfBoard);

test.beforeEach(async ({ page }) => { await openGame(page, '2048'); });

test('une partie démarre avec deux tuiles', async ({ page }) => {
  expect((await board(page)).flat().filter(Boolean)).toHaveLength(2);
  await expect(page.locator('.tf-tile')).toHaveCount(2);
});

test('les tuiles glissent et fusionnent, le score augmente', async ({ page }) => {
  await setBoard(page, [[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await page.keyboard.press('ArrowLeft');
  const b = await board(page);
  expect(b[0].slice(0, 2)).toEqual([4, 4]);
  await expect(page.locator('#tfScore')).toHaveText('4');
});

test('les touches Z Q S D jouent comme les flèches', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0.99; });          // la nouvelle tuile apparaît toujours à la dernière case vide (résultat déterministe)
  await setBoard(page, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]]);
  await page.keyboard.press('q');
  expect((await board(page))[3][0]).toBe(2);
  await page.keyboard.press('z');
  expect((await board(page))[0][0]).toBe(2);
});

test('un coup qui ne change rien n\'ajoute pas de tuile', async ({ page }) => {
  await setBoard(page, [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await page.keyboard.press('ArrowLeft');
  expect((await board(page)).flat().filter(Boolean)).toHaveLength(2);
});

test('les tuiles sont exactement sur les cases de la grille', async ({ page }) => {
  await setBoard(page, [[2, 0, 0, 4], [0, 8, 0, 0], [0, 0, 16, 0], [1024, 0, 0, 2048]]);
  const gaps = await page.evaluate(() => {
    const bg = [...document.querySelectorAll('.tf-cell')].map(e => e.getBoundingClientRect());
    return [...document.querySelectorAll('.tf-tile')].map(t => {
      const r = t.getBoundingClientRect();
      return Math.min(...bg.map(c => Math.abs(c.left - r.left) + Math.abs(c.top - r.top) + Math.abs(c.width - r.width)));
    });
  });
  for (const gap of gaps) expect(gap).toBeLessThan(5);
});

test('atteindre 2048 propose de continuer, puis la fin de partie enregistre le score', async ({ page }) => {
  await setBoard(page, [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#tfBanner')).toContainText('2048');
  await page.keyboard.press('ArrowDown');                              // en pause : ignoré
  expect((await board(page))[0][0]).toBe(2048);
  await page.locator('#tfContinue').click();
  // une grille bloquée avec un seul coup possible, qui la remplit sans fusion
  await setBoard(page, [[2, 4, 2, 4], [4, 2, 4, 2], [16, 32, 16, 32], [8, 2, 4, 0]], 2048);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tfBanner')).toContainText('Plus de mouvement');
  await modalReady(page);
  await expect(page.locator('.sc-big')).toHaveText('2048 pts');
  await page.keyboard.press('Escape');                                // « Passer »
  await expect(page.locator('.sc-panel')).toHaveCount(0);
});

test('le meilleur score vient du tableau des scores et survit au rechargement', async ({ page }) => {
  await page.evaluate(() => scAdd('2048', 'all', 3000, 'TOP'));
  await page.reload();
  await page.locator('.card', { hasText: '2048' }).click();
  await expect(page.locator('#tfBest')).toHaveText('3000');
});

test('nouvelle partie : confirmation si la partie a commencé', async ({ page }) => {
  await setBoard(page, [[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 120);
  await page.locator('#tfReset').click();
  await expect(page.locator('.sc-kicker')).toContainText('ABANDONNER');
  await modalReady(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('#tfScore')).toHaveText('0');
});
