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
    await expect(page.locator('#snPad')).toHaveCount(0);                // plus de manette : on joue au glissement du doigt
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

// Tout ce qui sert à jouer est visible dans l'écran, sans jamais défiler verticalement
async function expectFits(page, label) {
  const r = await page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth, issues = [];
    const de = document.scrollingElement;
    if (de.scrollHeight > vh + 1) issues.push('la page défile : ' + de.scrollHeight + ' > ' + vh);
    if (de.scrollWidth > vw + 1) issues.push('la page déborde en largeur : ' + de.scrollWidth + ' > ' + vw);
    const content = document.querySelector('#game-shell.on #game-content');
    if (content && content.scrollHeight > content.clientHeight + 1) issues.push('le contenu du jeu est coupé : ' + content.scrollHeight + ' > ' + content.clientHeight);
    const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const sel = ['.shell-bar .btn', '.shell-bar .back-btn', '#game-content select', '#game-content .ms-controls .btn', '#game-content .sn-controls .btn',
      '#game-content .wd-controls .btn', '#wdGrid', '.wd-key', '#msGrid', '#snCanvas', '#sdGrid', '#sdPad .btn', '#sdTools .btn', '#mfGrid', '.mf-key', '#mfTools .btn', '#mfClue', '#solBoard', '.sol-slot',
      'details.rules summary', '.menu-bar .btn', '.card'];
    for (const q of sel) for (const e of document.querySelectorAll(q)) {
      if (!visible(e)) continue;
      const b = e.getBoundingClientRect();
      if (e.id === 'msGrid') { if (b.top < -1 || b.bottom > vh + 1) issues.push(q + ' sort verticalement'); continue; }   // la grille « Difficile » défile en largeur, jamais en hauteur
      if (b.top < -1 || b.bottom > vh + 1 || b.left < -1 || b.right > vw + 1) issues.push(q + ' sort de l\'écran (' + Math.round(b.top) + '→' + Math.round(b.bottom) + ' sur ' + vh + ')');
    }
    return issues;
  });
  expect(r, label).toEqual([]);
}

const PHONES = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915]];

test.describe('mise en page : tout tient dans l\'écran, sans défilement vertical', () => {
  for (const [w, h] of PHONES) {
    test(`téléphone ${w}×${h} : le menu et les six jeux tiennent entièrement`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await expectFits(page, 'menu');
      for (const game of ['Wordle', 'Démineur', 'Snake', 'Sudoku', 'Mots fléchés', 'Solitaire']) {
        await page.locator('.card', { hasText: game }).tap();
        await page.waitForTimeout(120);
        await expectFits(page, game);
        await page.getByRole('button', { name: /Retour au menu/ }).tap();
      }
    });
  }

  test('Wordle 7 lettres, Démineur « Difficile », Sudoku « Difficile » : toujours dans l\'écran à 320×568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openGame(page, 'Wordle');
    await page.selectOption('#wdLen', '7');
    await expectFits(page, 'Wordle 7');
    await page.getByRole('button', { name: /Retour au menu/ }).tap();
    await page.locator('.card', { hasText: 'Démineur' }).tap();
    await page.selectOption('#diff', 'hard');
    await page.locator('.cell[data-r="8"][data-c="8"]').tap();
    await expectFits(page, 'Démineur difficile');
    expect(await page.locator('.grid-wrap').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);   // défile en largeur seulement
    await page.getByRole('button', { name: /Retour au menu/ }).tap();
    await page.locator('.card', { hasText: 'Sudoku' }).tap();
    await page.selectOption('#sdLevel', 'hard');
    await expectFits(page, 'Sudoku difficile');
    await page.getByRole('button', { name: /Retour au menu/ }).tap();
    await page.locator('.card', { hasText: 'Mots fléchés' }).tap();
    await page.selectOption('#mfLevel', 'large');
    await expectFits(page, 'Mots fléchés grande grille');
    const cell = await page.locator('#mfGrid .mf-cell').first().boundingBox();
    expect(Math.min(cell.width, cell.height), 'cases assez grandes pour être touchées').toBeGreaterThanOrEqual(24);
  });

  test('Solitaire : une colonne de 19 cartes se resserre pour tenir à l\'écran', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openGame(page, 'Solitaire');
    await page.evaluate(() => {
      sol = solDeal(1);
      const down = [0, 1, 2, 3, 4, 5].map(r => ({ s: 3, r: r + 1, up: false }));
      const up = []; for (let r = 13; r >= 1; r--) up.push({ s: r % 2 ? 0 : 1, r, up: true });
      sol.tab = [[], [], [], [], [], [], [...down, ...up]];
      solRender();
    });
    await expectFits(page, 'Solitaire, colonne de 19 cartes');
    const r = await page.evaluate(() => {
      const board = document.getElementById('solBoard').getBoundingClientRect();
      const last = [...document.querySelectorAll('.sol-card[data-zone="t"][data-i="6"]')].pop().getBoundingClientRect();
      return { boardBottom: board.bottom, lastBottom: last.bottom };
    });
    expect(r.lastBottom).toBeLessThanOrEqual(r.boardBottom + 1);          // la dernière carte est entièrement visible
    // les coins des cartes restent lisibles (au moins ~10 px entre deux cartes visibles)
    const gap = await page.evaluate(() => { const c = [...document.querySelectorAll('.sol-card[data-zone="t"][data-i="6"]')].slice(-3); return c[2].getBoundingClientRect().top - c[1].getBoundingClientRect().top; });
    expect(gap).toBeGreaterThanOrEqual(9);
  });

  test('les règles sont un onglet replié ; ouvert, il se superpose au jeu sans le déplacer', async ({ page }) => {
    await openGame(page, 'Sudoku');
    const before = await page.locator('#sdGrid').boundingBox();
    await page.locator('details.rules summary').tap();
    const sheet = await page.locator('details.rules ul').boundingBox();
    const vh = page.viewportSize().height;
    expect(sheet.y).toBeGreaterThanOrEqual(0);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(vh + 1);          // la feuille tient dans l'écran
    expect(await page.locator('details.rules ul').evaluate(e => e.scrollHeight <= e.clientHeight + 1)).toBe(true);   // sans défilement interne
    const after = await page.locator('#sdGrid').boundingBox();
    expect(after.y).toBe(before.y);                                       // la grille n'a pas bougé
    await expectFits(page, 'Sudoku, règles ouvertes');
    await page.locator('details.rules summary').tap();
    await expect(page.locator('details.rules')).not.toHaveAttribute('open', '');
  });

  test('les fenêtres (scores, réglages, saisie du nom) tiennent dans l\'écran', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.getByRole('button', { name: '⚙ Réglages' }).tap();
    expect(await page.evaluate(() => { const b = document.querySelector('.sc-panel').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 1; })).toBe(true);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { for (let i = 1; i <= 10; i++) scAdd('snake', 'medium', i * 10, 'AAA'); scShow('snake', 'medium'); });
    const r = await page.evaluate(() => { const p = document.querySelector('.sc-panel'); const b = p.getBoundingClientRect(); return { fits: b.top >= 0 && b.bottom <= innerHeight + 1, scrolls: p.scrollHeight > p.clientHeight + 1 }; });
    expect(r.fits).toBe(true);
    expect(r.scrolls).toBe(false);                                        // même avec 10 scores, pas de défilement dans la fenêtre
    await page.evaluate(() => scClose());
    await page.evaluate(() => scSubmit('snake', 'medium', 555));
    await modalReady(page);
    expect(await page.evaluate(() => { const p = document.querySelector('.sc-panel'); const b = p.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight + 1 && p.scrollHeight <= p.clientHeight + 1; })).toBe(true);
  });

  test('le plateau ne bouge pas quand on essaie de faire défiler la page', async ({ page }) => {
    await openGame(page, 'Sudoku');
    const before = await page.locator('#sdGrid').boundingBox();
    await touchDrag(page, { x: 200, y: 500 }, { x: 200, y: 100 }, { steps: 10 });   // glisser vers le haut sur la grille
    await page.evaluate(() => window.scrollTo(0, 400));
    const after = await page.locator('#sdGrid').boundingBox();
    expect(after.y).toBe(before.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('les boutons et les chiffres à toucher font au moins 44 px de haut', async ({ page }) => {
    await openGame(page, 'Sudoku');
    for (const sel of ['#sdPad [data-n="5"]', '#sdTools [data-a="hint"]', '#sdReset', '#sdLevel', '#pauseBtn']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.height, sel).toBeGreaterThanOrEqual(44);
    }
  });

  test('le titre du jeu est dans la barre du haut et les textes d\'aide du clavier sont masqués', async ({ page }) => {
    await openGame(page, 'Démineur');
    await expect(page.locator('#shellTitle')).toHaveText('💣 Démineur');
    await expect(page.locator('.hint')).toBeHidden();
    await expect(page.locator('.ms-title')).toBeHidden();
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

  test('Snake : un glissement n\'importe où sur l\'écran lance la partie et tourne le serpent', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.selectOption('#snDiff', 'slow');
    const area = await page.locator('.sn-area').boundingBox();
    const mid = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    await touchDrag(page, mid, { x: mid.x, y: mid.y - 90 });             // vers le haut : démarre
    expect(await page.evaluate(() => snRunning)).toBe(true);
    await page.evaluate(() => clearInterval(snLoop));                    // on fige les ticks pour tester la file de directions
    await touchDrag(page, mid, { x: mid.x - 90, y: mid.y });             // vers la gauche
    expect(await page.evaluate(() => snQueue.join())).toBe('L');
    const bar = await page.locator('.shell-title').boundingBox();         // un glissement hors de la grille compte aussi (zone « barre du haut » exclue : ce sont des boutons)
    await touchDrag(page, { x: 30, y: area.y + area.height - 10 }, { x: 30, y: area.y + area.height - 100 });   // le long du bord, vers le haut
    expect(await page.evaluate(() => snQueue.join())).toBe('L,U');
    expect(bar.height).toBeGreaterThan(0);
  });

  test('Snake : un virage enchaîné sans lever le doigt', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.selectOption('#snDiff', 'slow');
    await page.locator('.sn-area').tap();                                // toucher démarre (vers la droite)
    expect(await page.evaluate(() => snRunning)).toBe(true);
    await page.evaluate(() => clearInterval(snLoop));
    const area = await page.locator('.sn-area').boundingBox();
    const client = await page.context().newCDPSession(page);
    const send = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const [x, y] = [area.x + area.width / 2, area.y + area.height / 2];
    await send('touchStart', x, y);
    await send('touchMove', x, y + 60);                                   // bas…
    await send('touchMove', x - 60, y + 60);                              // … puis gauche, sans lever le doigt
    await send('touchEnd');
    expect(await page.evaluate(() => snQueue.join())).toBe('D,L');
    await client.detach();
  });

  test('Snake : la page est figée (pas de défilement ni de rafraîchissement par glissement)', async ({ page }) => {
    await openGame(page, 'Snake');
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('game-shell')).touchAction)).toBe('none');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY)).toBe('none');
  });

  test('Snake : le bouton ⏸ de la barre met en pause, toucher le voile reprend', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.selectOption('#snDiff', 'slow');
    await page.locator('.sn-area').tap();
    await page.locator('#pauseBtn').tap();
    expect(await page.evaluate(() => snPaused)).toBe(true);
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    await page.locator('#pauseOverlay').tap();
    expect(await page.evaluate(() => snPaused)).toBe(false);
  });

  test('Snake : toucher l\'écran démarre, et rejoue après une défaite', async ({ page }) => {
    await openGame(page, 'Snake');
    await page.locator('.sn-area').tap();
    expect(await page.evaluate(() => snRunning)).toBe(true);
    await page.evaluate(() => { snScore = 0; snGameOver(); });
    await page.locator('.sn-area').tap({ force: true });
    expect(await page.evaluate(() => snRunning)).toBe(true);
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
    expect(await page.evaluate(() => sol.found.map(f => f.length))).toEqual([0, 0, 1, 0]);    // A♦ sur la fondation ♦
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

test.describe('Mots fléchés sur téléphone', () => {
  test('le clavier de lettres écrit dans la grille, ⌫ efface, toucher une définition change de mot', async ({ page }) => {
    await openGame(page, 'Mots fléchés');
    await expect(page.locator('.mf-keys')).toBeVisible();
    const s = await page.evaluate(() => { const sl = mf.slots[mfActive()]; return { first: sl.cells[0], second: sl.cells[1], l: mf.sol[sl.cells[0]] }; });
    await page.locator(`.mf-key[data-k="${s.l}"]`).tap();
    await expect(page.locator(`#mfGrid .mf-cell[data-i="${s.first}"]`)).toHaveText(s.l);
    expect(await page.evaluate(() => mf.sel)).toBe(s.second);
    await page.locator('.mf-key[data-k="back"]').tap();
    await expect(page.locator(`#mfGrid .mf-cell[data-i="${s.first}"]`)).toHaveText('');
    const last = await page.evaluate(() => mf.slots.length - 1);
    await page.locator(`#mfGrid [data-slot="${last}"]`).tap();
    expect(await page.evaluate(() => mfActive())).toBe(last);
    await expect(page.locator('#mfClue')).toContainText('(');
  });

  test('toucher une case déjà choisie change de sens ; les trois tailles de grille tiennent à l\'écran', async ({ page }) => {
    await openGame(page, 'Mots fléchés');
    const cross = await page.evaluate(() => mf.at.findIndex(a => a.h >= 0 && a.v >= 0));
    await page.locator(`#mfGrid .mf-cell[data-i="${cross}"]`).tap();
    const d1 = await page.evaluate(() => mf.dir);
    await page.locator(`#mfGrid .mf-cell[data-i="${cross}"]`).tap();
    expect(await page.evaluate(() => mf.dir)).not.toBe(d1);
    for (const level of ['small', 'medium', 'large']) {
      await page.selectOption('#mfLevel', level);
      await expectFits(page, 'Mots fléchés ' + level);
    }
  });
});
