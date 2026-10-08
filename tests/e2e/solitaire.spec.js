const { test, expect, modalReady, openGame } = require('./fixtures');

const C = (s, r, up = true) => ({ s, r, up });   // s : 0 ♠, 1 ♥, 2 ♦, 3 ♣
const empty = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], moves: 0, won: false, draw: 1 };
const setGame = (page, state) => page.evaluate(st => { sol = st; solSel = null; solHist = []; solRender(); }, { ...empty, ...state });
const card = (page, i, idx) => page.locator(`.sol-card[data-zone="t"][data-i="${i}"]` + (idx === undefined ? '' : `[data-idx="${idx}"]`));
const corner = { position: { x: 8, y: 8 } };   // les cartes se chevauchent : on clique leur coin visible

test.beforeEach(async ({ page }) => { await openGame(page, 'Solitaire'); });

test('une donne : 7 colonnes de 1 à 7 cartes, 24 cartes en pioche, dernière carte de chaque colonne visible', async ({ page }) => {
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(await page.evaluate(() => sol.stock.length)).toBe(24);
  await expect(page.locator('.sol-card.back')).toHaveCount(22);   // 21 cartes cachées dans les colonnes + le dos de la pioche
});

test('la pioche retourne une carte, annuler la remet, le chrono démarre au premier coup', async ({ page }) => {
  await expect(page.locator('#solTime')).toHaveText('0:00');
  await page.locator('.sol-slot[data-zone="s"]').click();
  expect(await page.evaluate(() => [sol.waste.length, sol.stock.length])).toEqual([1, 23]);
  await page.waitForFunction(() => solElapsed >= 1);                 // le chrono tourne
  await expect(page.locator('#solTime')).toHaveText(/^0:0[1-9]$/);
  await page.locator('#solUndo').click();
  expect(await page.evaluate(() => [sol.waste.length, sol.stock.length, sol.moves])).toEqual([0, 24, 0]);
});

test('pioche de 3 cartes : trois cartes retournées d\'un coup', async ({ page }) => {
  await page.selectOption('#solDraw', '3');
  await page.locator('.sol-slot[data-zone="s"]').click();
  expect(await page.evaluate(() => sol.waste.length)).toBe(3);
});

test('une pioche vide se remélange en recliquant dessus', async ({ page }) => {
  await setGame(page, { stock: [], waste: [C(0, 5), C(1, 9)] });
  await page.locator('.sol-slot[data-zone="s"]').click();
  expect(await page.evaluate(() => [sol.stock.length, sol.waste.length])).toEqual([2, 0]);
});

test('clic sur une carte puis sur sa destination', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 7)], [C(1, 8)], [], [], [], [], []] });
  await card(page, 0).click(corner);
  await expect(card(page, 0)).toHaveClass(/sel/);
  await card(page, 1).click(corner);
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([0, 2, 0, 0, 0, 0, 0]);
});

test('un coup interdit désélectionne sans rien déplacer', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 7)], [C(3, 8)], [], [], [], [], []] });   // 7♠ sur 8♣ : noir sur noir → refusé
  await card(page, 0).click(corner);
  await card(page, 1).click(corner);
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([1, 1, 0, 0, 0, 0, 0]);
});

test('double-clic : un as monte directement à la fondation', async ({ page }) => {
  await setGame(page, { tab: [[C(2, 1)], [C(0, 9)], [], [], [], [], []] });
  await card(page, 0).dblclick(corner);
  expect(await page.evaluate(() => sol.found.map(f => f.length))).toEqual([1, 0, 0, 0]);
});

test('double-clic depuis la pioche : la carte de la défausse monte à la fondation', async ({ page }) => {
  await setGame(page, { waste: [C(1, 1)], tab: [[C(0, 9)], [], [], [], [], [], []] });
  await page.locator('.sol-card[data-zone="w"]').dblclick();
  expect(await page.evaluate(() => [sol.found.flat().length, sol.waste.length])).toEqual([1, 0]);
});

test('double-clic : une dame noire va sous le roi rouge, seule destination possible', async ({ page }) => {
  await setGame(page, { waste: [C(0, 12)], tab: [[C(1, 13)], [C(2, 5)], [C(2, 9)], [], [], [], []] });
  await page.locator('.sol-card[data-zone="w"]').dblclick();
  expect(await page.evaluate(() => sol.tab[0].map(c => c.r))).toEqual([13, 12]);
});

test('double-clic : plusieurs destinations possibles → la carte reste sélectionnée', async ({ page }) => {
  await setGame(page, { tab: [[C(1, 7)], [C(0, 8)], [C(3, 8)], [], [], [], []] });
  await card(page, 0).dblclick(corner);
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([1, 1, 1, 0, 0, 0, 0]);
  await expect(card(page, 0)).toHaveClass(/sel/);
});

test('double-clic sur un roi seul au fond d\'une colonne : il ne bouge pas', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 13)], [], [], [], [], [], []] });
  await card(page, 0).dblclick(corner);
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([1, 0, 0, 0, 0, 0, 0]);
});

test('glisser-déposer : une carte vers une colonne, une suite vers une colonne vide', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 13), C(1, 12)], [C(1, 8)], [C(0, 7)], [], [], [], []] });
  const drag = async (from, to) => {
    const a = await from.boundingBox(), b = await to.boundingBox();
    await page.mouse.move(a.x + 10, a.y + 10);
    await page.mouse.down();
    await page.mouse.move(a.x + 30, a.y + 40, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
    await page.mouse.up();
  };
  await drag(card(page, 2), card(page, 1));                                // 7♠ sur 8♥
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([2, 2, 0, 0, 0, 0, 0]);
  await drag(card(page, 0, 0), page.locator('.sol-slot[data-zone="t"][data-i="4"]'));   // R♠+D♥ vers une colonne vide
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([0, 2, 0, 0, 2, 0, 0]);
});

test('glisser vers un endroit interdit remet la carte en place', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 7)], [C(3, 8)], [], [], [], [], []] });
  const a = await card(page, 0).boundingBox(), b = await card(page, 1).boundingBox();
  await page.mouse.move(a.x + 10, a.y + 10);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([1, 1, 0, 0, 0, 0, 0]);
  await expect(card(page, 0)).toHaveCSS('opacity', '1');
});

test('Ctrl+Z annule le dernier coup, N demande confirmation en pleine partie', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 7)], [C(1, 8)], [], [], [], [], []] });
  await card(page, 0).dblclick(corner);
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([0, 2, 0, 0, 0, 0, 0]);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([1, 1, 0, 0, 0, 0, 0]);
  await page.evaluate(() => { sol.moves = 5; });
  await page.keyboard.press('n');
  await expect(page.locator('.sc-kicker')).toContainText('ABANDONNER');
  await modalReady(page);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => sol.moves)).toBe(0);
});

test('« plus de coup utile » apparaît quand la donne est bloquée, et disparaît après annulation', async ({ page }) => {
  await setGame(page, { tab: [[C(0, 5)], [C(1, 5)], [], [], [], [], []] });
  await expect(page.locator('#solBanner')).toContainText('Plus de coup utile');
  await setGame(page, { tab: [[C(0, 5)], [C(1, 4)], [], [], [], [], []] });
  await expect(page.locator('#solBanner')).toHaveText('');
});

test('complétion automatique : les cartes montent seules jusqu\'à la victoire, le score est proposé', async ({ page }) => {
  const run = (s, n) => Array.from({ length: n }, (_, k) => C(s, k + 1));
  await setGame(page, {
    moves: 30,
    found: [run(0, 10), run(1, 9), run(2, 11), run(3, 8)],
    tab: [[C(3, 13), C(3, 12), C(3, 11), C(3, 10), C(3, 9)], [C(1, 13), C(1, 12), C(1, 11), C(1, 10)], [C(0, 13), C(0, 12), C(0, 11)], [C(2, 13), C(2, 12)], [], [], []]
  });
  await page.evaluate(() => solUpdate());
  await expect(page.locator('#solBanner')).toContainText('Bravo', { timeout: 15000 });
  await modalReady(page);
  await expect(page.locator('.sc-big')).toContainText('coups');
  await page.keyboard.type('sol');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sc-row.hi')).toContainText('SOL');
});

test('pas de complétion automatique quand une carte en bloque une autre', async ({ page }) => {
  await setGame(page, { found: [[C(0, 1)], [], [], []], tab: [[C(0, 3), C(0, 4)], [C(0, 2)], [], [], [], [], []] });
  await page.evaluate(() => solUpdate());
  expect(await page.evaluate(() => solAuto)).toBe(false);
});

test('quitter le jeu en pleine complétion automatique ne pollue pas la donne suivante', async ({ page }) => {
  const run = (s, n) => Array.from({ length: n }, (_, k) => C(s, k + 1));
  await setGame(page, { moves: 9, found: [run(0, 2), run(1, 13), run(2, 13), run(3, 13)], tab: [[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].reverse().map(r => C(0, r)), [], [], [], [], [], []] });
  await page.evaluate(() => solUpdate());
  await page.keyboard.press('Escape');                      // la partie est sauvegardée, la complétion s'arrête
  await page.evaluate(() => Save.store('solitaire', null));  // on repart d'une donne neuve
  await page.locator('.card', { hasText: 'Solitaire' }).click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => sol.found.flat().length)).toBe(0);
  expect(await page.evaluate(() => solAuto)).toBe(false);
});
