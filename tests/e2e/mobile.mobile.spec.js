// Tests sur téléphone (écran tactile émulé, 412 px de large) : détection de l'appareil et commandes tactiles de chaque jeu.
const { test, expect, modalReady, openGame, touchDrag, touchHold } = require('./fixtures');

const C = (s, r, up = true) => ({ s, r, up });
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('détection de l\'appareil', () => {
  test('un téléphone est détecté comme mobile : commandes tactiles visibles, aides adaptées', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-device', 'mobile');
    expect(await page.evaluate(() => Device.detect())).toBe('mobile');
    await page.locator('.card', { hasText: 'Snake' }).tap();
    await expect(page.locator('#snPad')).toBeVisible();
    await expect(page.locator('.sn-overlay .only-mobile')).toBeVisible();
    await expect(page.locator('.sn-overlay .only-desktop')).toBeHidden();
  });

  test('le réglage « Affichage » force le mode ordinateur, puis revient en automatique', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '⚙ Réglages' }).tap();
    const row = page.locator('.set-row[data-k="device"]');
    await expect(row).toContainText('AUTO');
    await row.tap();                                                   // auto → mobile
    await expect(row).toContainText('MOBILE');
    await row.tap();                                                   // → ordinateur
    await expect(row).toContainText('ORDI');
    await expect(page.locator('html')).toHaveAttribute('data-device', 'desktop');
    await row.tap();                                                   // → auto : redevient mobile
    await expect(page.locator('html')).toHaveAttribute('data-device', 'mobile');
    expect(await page.evaluate(() => Settings.get('device'))).toBe('auto');
  });

  test('le choix d\'affichage est mémorisé après rechargement', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => Settings.set('device', 'desktop'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-device', 'desktop');
  });
});

test.describe('mise en page', () => {
  test('aucun écran ne déborde de la largeur (téléphone étroit de 320 px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    expect(await noOverflow(page)).toBe(true);
    for (const game of ['Wordle', 'Démineur', 'Snake', 'Sudoku', 'Solitaire']) {
      await page.locator('.card', { hasText: game }).tap();
      await page.waitForTimeout(150);
      expect(await noOverflow(page), game).toBe(true);
      await page.getByRole('button', { name: /Retour au menu/ }).tap();
    }
  });

  test('Wordle 7 lettres : toutes les tuiles tiennent dans l\'écran', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openGame(page, 'Wordle');
    await page.selectOption('#wdLen', '7');
    const right = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#wdGrid .wd-tile')].map(t => t.getBoundingClientRect().right)));
    expect(right).toBeLessThanOrEqual(320);
    const keyRight = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.wd-key')].map(t => t.getBoundingClientRect().right)));
    expect(keyRight).toBeLessThanOrEqual(320);
  });

  test('les boutons et les chiffres à toucher font au moins 44 px de haut', async ({ page }) => {
    await openGame(page, 'Sudoku');
    for (const sel of ['#sdPad [data-n="5"]', '#sdTools [data-a="hint"]', '#sdReset', '#sdLevel']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.height, sel).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('commandes tactiles', () => {
  test('menu : toucher une carte ouvre le jeu, le bouton retour revient au menu', async ({ page }) => {
    await page.goto('/');
    await page.locator('.card', { hasText: 'Solitaire' }).tap();
    await expect(page.locator('#solBoard')).toBeVisible();
    await page.getByRole('button', { name: /Retour au menu/ }).tap();
    await expect(page.locator('#menu')).toBeVisible();
  });

  test('Wordle : le clavier à l\'écran suffit pour gagner', async ({ page }) => {
    await openGame(page, 'Wordle');
    const target = await page.evaluate(() => wdTarget);
    for (const k of target) await page.locator('.wd-key', { hasText: new RegExp('^' + k + '$') }).tap();
    await page.locator('.wd-key', { hasText: 'Entrée' }).tap();
    await expect(page.locator('#wdMsg')).toContainText('Bravo');
  });

  test('Démineur : toucher révèle, le bouton 🚩 pose un drapeau', async ({ page }) => {
    await openGame(page, 'Démineur');
    await page.selectOption('#diff', 'easy');
    await page.locator('.cell[data-r="4"][data-c="4"]').tap();
    expect(await page.evaluate(() => msStarted && msRevealed[4][4])).toBe(true);
    const [r, c] = await page.evaluate(() => { for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!msRevealed[r][c]) return [r, c]; });
    const cell = page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);
    await page.locator('#msFlagBtn').tap();
    await expect(page.locator('#msFlagBtn')).toHaveAttribute('aria-pressed', 'true');
    await cell.tap();
    await expect(cell).toHaveText('🚩');
    await cell.tap();                                                  // un 2e toucher retire le drapeau
    await expect(cell).toHaveText('');
  });

  test('Démineur : un appui long pose un drapeau (une seule fois)', async ({ page }) => {
    await openGame(page, 'Démineur');
    await page.selectOption('#diff', 'easy');
    await page.locator('.cell[data-r="4"][data-c="4"]').tap();
    const [r, c] = await page.evaluate(() => { for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!msRevealed[r][c]) return [r, c]; });
    const cell = page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);
    await touchHold(page, cell, 800);
    await page.waitForTimeout(400);                                    // laisse passer un éventuel « contextmenu » tactile
    await expect(cell).toHaveText('🚩');
    expect(await page.evaluate(() => msFlagged.flat().filter(Boolean).length)).toBe(1);
    expect(await page.evaluate(([r, c]) => msRevealed[r][c], [r, c])).toBe(false);   // pas révélée par le clic qui suit
  });

  test('Démineur difficile : la grille défile horizontalement dans son cadre, pas la page', async ({ page }) => {
    await openGame(page, 'Démineur');
    await page.selectOption('#diff', 'hard');
    expect(await page.locator('.grid-wrap').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
    expect(await noOverflow(page)).toBe(true);
  });

  test('Snake : la manette lance la partie et tourne le serpent, ⏸ met en pause', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.selectOption('#snDiff', 'slow');
    await page.locator('#snPad [data-dir="U"]').tap();
    expect(await page.evaluate(() => snRunning)).toBe(true);
    await page.evaluate(() => clearInterval(snLoop));                  // on fige les ticks pour tester la file de directions
    await page.locator('#snPad [data-dir="L"]').tap();
    expect(await page.evaluate(() => snQueue.join())).toBe('L');
    await page.locator('#snPause').tap();
    expect(await page.evaluate(() => snPaused)).toBe(true);
    await page.locator('#snPause').tap();
    expect(await page.evaluate(() => snPaused)).toBe(false);
  });

  test('Snake : glisser le doigt sur la grille tourne le serpent', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.selectOption('#snDiff', 'slow');
    await page.locator('#snPad [data-dir="U"]').tap();
    await page.evaluate(() => clearInterval(snLoop));
    const canvas = page.locator('#snCanvas');
    const p = await canvas.boundingBox();
    const mid = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
    await touchDrag(page, mid, { x: mid.x - 80, y: mid.y });           // vers la gauche
    expect(await page.evaluate(() => snQueue.join())).toBe('L');
    await touchDrag(page, mid, { x: mid.x, y: mid.y + 80 });           // vers le bas
    expect(await page.evaluate(() => snQueue.join())).toBe('L,D');
  });

  test('Snake : toucher la grille démarre, puis reprend après une pause', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.locator('.sn-wrap').tap();                              // le message de démarrage recouvre la grille : le toucher le traverse
    expect(await page.evaluate(() => snRunning)).toBe(true);
    await page.evaluate(() => snPause(true));
    await page.locator('.sn-wrap').tap();
    expect(await page.evaluate(() => snPaused)).toBe(false);
  });

  test('Sudoku : on remplit une case avec le pavé, les notes et l\'indice se touchent', async ({ page }) => {
    await openGame(page, 'Sudoku');
    const i = await page.evaluate(() => sd.puzzle.findIndex(v => !v));
    const v = await page.evaluate(i => sd.solution[i], i);
    const cell = page.locator(`.sd-cell[data-i="${i}"]`);
    await cell.tap();
    await page.locator(`#sdPad [data-n="${v}"]`).tap();
    await expect(cell).toHaveText(String(v));
    const j = await page.evaluate(() => sd.puzzle.findIndex((x, k) => !x && sd.grid[k] === 0));
    await page.locator(`.sd-cell[data-i="${j}"]`).tap();
    await page.locator('#sdTools [data-a="notes"]').tap();
    await page.locator('#sdPad [data-n="3"]').tap();
    await page.locator('#sdPad [data-n="5"]').tap();
    expect(await page.evaluate(j => sd.notes[j], j)).toBe((1 << 3) | (1 << 5));
    await page.locator('#sdTools [data-a="notes"]').tap();
    await page.locator('#sdTools [data-a="hint"]').tap();
    await expect(page.locator('#sdHints')).toHaveText('1');
  });

  test('Solitaire : toucher une carte puis sa destination, double-tap vers la fondation', async ({ page }) => {
    await openGame(page, 'Solitaire');
    await page.evaluate(st => { sol = st; solRender(); }, {
      stock: [], waste: [], found: [[], [], [], []], moves: 0, won: false, draw: 1,
      tab: [[C(0, 7)], [C(1, 8)], [C(2, 1)], [], [], [], []]
    });
    const card = i => page.locator(`.sol-card[data-zone="t"][data-i="${i}"]`);
    await card(0).tap();
    await expect(card(0)).toHaveClass(/sel/);
    await card(1).tap();
    expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([0, 2, 1, 0, 0, 0, 0]);
    await card(2).tap();
    await card(2).tap();                                               // double-tap
    expect(await page.evaluate(() => sol.found.map(f => f.length))).toEqual([1, 0, 0, 0]);
  });

  test('Solitaire : on peut glisser une carte avec le doigt', async ({ page }) => {
    await openGame(page, 'Solitaire');
    await page.evaluate(st => { sol = st; solRender(); }, {
      stock: [], waste: [], found: [[], [], [], []], moves: 0, won: false, draw: 1,
      tab: [[C(0, 7)], [C(1, 8)], [], [], [], [], []]
    });
    const card = i => page.locator(`.sol-card[data-zone="t"][data-i="${i}"]`);
    await touchDrag(page, card(0), card(1), { steps: 10 });
    expect(await page.evaluate(() => sol.tab.map(c => c.length))).toEqual([0, 2, 0, 0, 0, 0, 0]);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);         // la page n'a pas défilé pendant le glissement
  });

  test('saisie du nom : les flèches ▲ ▼ se touchent, puis le tableau s\'affiche', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => scSubmit('snake', 'medium', 12));
    await modalReady(page);
    await page.locator('.sc-slot').nth(0).locator('[data-a="up"]').tap();      // A → B
    await page.locator('.sc-slot').nth(1).locator('[data-a="down"]').tap();    // A → Z
    await expect(page.locator('.sc-letter')).toHaveText(['B', 'Z', 'A']);
    await page.locator('[data-a="ok"]').tap();
    await expect(page.locator('.sc-row.hi')).toContainText('BZA');
  });

  test('une partie mobile est reprise comme sur ordinateur', async ({ page }) => {
    await openGame(page, 'Sudoku');
    const i = await page.evaluate(() => sd.puzzle.findIndex(v => !v));
    await page.locator(`.sd-cell[data-i="${i}"]`).tap();
    await page.locator(`#sdPad [data-n="${await page.evaluate(i => sd.solution[i], i)}"]`).tap();
    const grid = await page.evaluate(() => sd.grid.join(''));
    await page.getByRole('button', { name: /Retour au menu/ }).tap();
    await page.locator('.card', { hasText: 'Sudoku' }).tap();
    expect(await page.evaluate(() => sd.grid.join(''))).toBe(grid);
  });
});
