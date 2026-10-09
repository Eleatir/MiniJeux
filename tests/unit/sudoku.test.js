const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

const g = load(['js/scores.js', 'js/settings.js', 'js/core.js', 'js/games/sudoku.js']);

// Générateur pseudo-aléatoire reproductible (mulberry32) : mêmes grilles à chaque exécution
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED_FN = 'globalThis.__seeded = ' + seeded.toString();
g.exec(SEED_FN);

const generate = (level, seed) => g.run(`sdGenerate(${JSON.stringify(level)}, __seeded(${seed}))`);
const valid = grid => {
  const groups = [];
  for (let k = 0; k < 9; k++) {
    groups.push([...Array(9).keys()].map(c => k * 9 + c));                                            // ligne
    groups.push([...Array(9).keys()].map(r => r * 9 + k));                                            // colonne
    groups.push([...Array(9).keys()].map(n => (Math.floor(k / 3) * 3 + Math.floor(n / 3)) * 9 + (k % 3) * 3 + (n % 3)));   // bloc
  }
  return groups.every(cells => cells.map(i => grid[i]).sort().join('') === '123456789');
};

test('sudoku : chaque case a 20 voisines (ligne, colonne, bloc) et jamais elle-même', () => {
  const peers = g.run('SD_PEERS');
  assert.equal(peers.length, 81);
  peers.forEach((p, i) => { assert.equal(p.length, 20); assert.ok(!p.includes(i)); });
  assert.deepEqual([...g.run('SD_PEERS[0]')].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 27, 36, 45, 54, 63, 72]);
});

test('sudoku : une grille complète générée respecte les règles', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const full = g.run(`sdFill(__seeded(${seed}))`);
    assert.equal(full.length, 81);
    assert.ok(valid(full), 'seed ' + seed);
  }
});

test('sudoku : le solveur compte exactement les solutions', () => {
  const full = g.run('sdFill(__seeded(7))');
  assert.equal(g.run(`sdCount(${JSON.stringify(full)}, 2)`), 1, 'grille complète : 1 solution');
  const blank = Array(81).fill(0);
  assert.equal(g.run(`sdCount(${JSON.stringify(blank)}, 2)`), 2, 'grille vide : au moins 2 (arrêt à la limite)');
  const a = full[0];
  const unique = full.slice(); unique[0] = 0;
  assert.equal(g.run(`sdCount(${JSON.stringify(unique)}, 2)`), 1, 'une seule case vide : 1 solution');
  const impossible = full.slice(); impossible[0] = 0; impossible[1] = a;   // doublon dans la ligne : aucune solution
  assert.equal(g.run(`sdCount(${JSON.stringify(impossible)}, 2)`), 0);
});

test('sudoku : le comptage ne modifie pas la grille donnée', () => {
  g.exec('globalThis.__p = sdGenerate("easy", __seeded(3)).puzzle');
  const before = g.run('__p.join("")');
  g.run('sdCount(__p, 2)');
  assert.equal(g.run('__p.join("")'), before);
});

for (const [level, target] of [['easy', 40], ['medium', 32], ['hard', 26]]) {
  test(`sudoku : une grille « ${level} » a une seule solution et ≈ ${target} cases données`, () => {
    for (let seed = 1; seed <= 4; seed++) {
      const { puzzle, solution, givens } = generate(level, seed);
      assert.ok(valid(solution), 'la solution est valide');
      assert.equal(puzzle.filter(Boolean).length, givens);
      assert.ok(givens >= 17, 'jamais moins de 17 indices');
      assert.ok(givens <= target + 3, `${level} : ${givens} indices au lieu de ~${target}`);
      puzzle.forEach((v, i) => { if (v) assert.equal(v, solution[i], 'les cases données sont celles de la solution'); });
      assert.equal(g.run(`sdCount(${JSON.stringify(puzzle)}, 2)`), 1, 'solution unique');
    }
  });
}

test('sudoku : la difficulté croît (moins d\'indices en difficile qu\'en facile)', () => {
  const avg = level => [1, 2, 3, 4].map(s => generate(level, s).givens).reduce((a, b) => a + b) / 4;
  assert.ok(avg('easy') > avg('medium'));
  assert.ok(avg('medium') > avg('hard'));
});

test('sudoku : les cases vides sont symétriques (rotation à 180°)', () => {
  const { puzzle } = generate('medium', 5);
  for (let i = 0; i < 81; i++) assert.equal(Boolean(puzzle[i]), Boolean(puzzle[80 - i]));
});

test('sudoku : la génération est rapide (3 niveaux × 5 grilles)', () => {
  const t0 = Date.now();
  for (const level of ['easy', 'medium', 'hard']) for (let s = 10; s < 15; s++) generate(level, s);
  assert.ok(Date.now() - t0 < 8000, 'trop lent : ' + (Date.now() - t0) + ' ms');
});

test('sudoku : les conflits sont détectés (ligne, colonne, bloc) et seulement eux', () => {
  const grid = Array(81).fill(0);
  grid[0] = 5; grid[8] = 5;          // même ligne
  grid[9 * 4 + 0] = 5;               // même colonne que la case 0
  grid[10] = 5;                      // même bloc que la case 0
  grid[40] = 7; grid[41] = 8;        // pas de conflit
  const bad = g.run(`[...sdConflicts(${JSON.stringify(grid)})].sort((a, b) => a - b)`);
  assert.deepEqual(bad, [0, 8, 10, 36]);
  assert.deepEqual(g.run('[...sdConflicts(Array(81).fill(0))]'), []);
});

test('sudoku : le score affiche minutes:secondes', () => {
  assert.equal(g.run('sdFmt(0)'), '0:00');
  assert.equal(g.run('sdFmt(65)'), '1:05');
  assert.equal(g.run('sdFmt(754)'), '12:34');
  assert.equal(g.run('SC_GAMES.sudoku.fmt(754)'), '12:34');
});

test('sudoku : la pénalité d\'un indice est de 30 secondes', () => {
  assert.equal(g.run('SD_PENALTY'), 30);
});
