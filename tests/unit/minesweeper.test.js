const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

const g = load(['js/scores.js', 'js/settings.js', 'js/core.js', 'js/games/minesweeper.js']);

// Prépare un plateau vide de la difficulté donnée
function setup(diff) {
  g.exec(`
    msCfg = MS_CONFIGS.${diff};
    msBoard = Array(msCfg.rows).fill(null).map(() => Array(msCfg.cols).fill(0));
    msRevealed = Array(msCfg.rows).fill(null).map(() => Array(msCfg.cols).fill(false));
    msFlagged = Array(msCfg.rows).fill(null).map(() => Array(msCfg.cols).fill(false));
    msMines = new Set();
  `);
}

test('démineur : bon nombre de mines pour chaque difficulté', () => {
  for (const [diff, mines] of [['easy', 10], ['medium', 40], ['hard', 99]]) {
    setup(diff);
    g.exec('msPlaceMines(0, 0)');
    assert.equal(g.run('msMines.size'), mines, diff);
  }
});

test('démineur : la première case et ses 8 voisines ne contiennent jamais de mine', () => {
  for (let i = 0; i < 200; i++) {
    setup('hard');
    const r = 1 + Math.floor(Math.random() * 14), c = 1 + Math.floor(Math.random() * 28);
    g.exec(`msPlaceMines(${r}, ${c})`);
    const bad = g.run(`(() => { const o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (msMines.has((${r}+dr)*msCfg.cols + (${c}+dc))) o.push([dr, dc]); return o; })()`);
    assert.deepEqual(bad, []);
  }
});

test('démineur : la première case est bien un « 0 » ouvrant une zone (même dans un coin)', () => {
  setup('medium');
  g.exec('msPlaceMines(0, 0)');
  assert.equal(g.run('msBoard[0][0]'), 0);
});

test('démineur : chaque chiffre vaut le nombre de mines voisines', () => {
  setup('medium');
  g.exec('msPlaceMines(8, 8)');
  const wrong = g.run(`(() => {
    const out = [];
    for (let r = 0; r < msCfg.rows; r++) for (let c = 0; c < msCfg.cols; c++) {
      if (msMines.has(r * msCfg.cols + c)) { if (msBoard[r][c] !== -1) out.push([r, c, 'mine']); continue; }
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const a = r + dr, b = c + dc;
        if ((dr || dc) && a >= 0 && a < msCfg.rows && b >= 0 && b < msCfg.cols && msMines.has(a * msCfg.cols + b)) n++;
      }
      if (msBoard[r][c] !== n) out.push([r, c, n, msBoard[r][c]]);
    }
    return out;
  })()`);
  assert.deepEqual(wrong, []);
});

test('démineur : révéler une case vide ouvre la zone et s\'arrête aux chiffres, sans toucher aux drapeaux', () => {
  setup('easy');
  // une seule mine en bas à droite
  g.exec(`
    msMines = new Set([8 * 9 + 8]);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) msBoard[r][c] = 0;
    msBoard[8][8] = -1; msBoard[7][7] = 1; msBoard[7][8] = 1; msBoard[8][7] = 1;
    msFlagged[4][4] = true;
    msReveal(0, 0);
  `);
  assert.equal(g.run('msRevealed[0][0]'), true);
  assert.equal(g.run('msRevealed[4][4]'), false, 'case marquée d\'un drapeau jamais révélée');
  assert.equal(g.run('msRevealed[7][7]'), true, 'le chiffre en bordure est révélé');
  assert.equal(g.run('msRevealed[8][8]'), false, 'la mine reste cachée');
});

test('démineur : le comptage des drapeaux autour d\'une case (chording)', () => {
  setup('easy');
  g.exec('msFlagged[0][0] = true; msFlagged[0][2] = true; msFlagged[3][3] = true;');
  assert.equal(g.run('msCountAround(0, 1, msFlagged)'), 2);
  assert.equal(g.run('msCountAround(4, 4, msFlagged)'), 1);
  assert.equal(g.run('msCountAround(8, 8, msFlagged)'), 0);
});
