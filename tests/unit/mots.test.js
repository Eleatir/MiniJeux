const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

const g = load(['js/scores.js', 'js/settings.js', 'js/core.js', 'js/games/mots-words.js', 'js/games/mots.js']);
const run = code => g.run(code);

// Générateur pseudo-aléatoire reproductible
const SEED = `let seed = 7; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };`;
const grids = level => run(`(function(){ ${SEED} return Array.from({ length: 12 }, () => mfGenerate('${level}', rnd)); })()`);

test('mots fléchés : lexique cohérent (majuscules sans accent, 2 à 7 lettres, sans doublon, définitions courtes)', () => {
  const raw = run('MF_RAW');
  const seen = new Set();
  for (const line of raw) {
    const [w, ...rest] = line.split('|'), def = rest.join('|');
    assert.match(w, /^[A-Z]{2,7}$/, line);
    assert.ok(def.length >= 3 && def.length <= 34, 'définition : ' + line);
    assert.ok(!seen.has(w), 'doublon : ' + w);
    seen.add(w);
  }
  assert.ok(raw.length > 600);
});

test('mots fléchés : assez de mots de chaque longueur pour fabriquer des grilles', () => {
  const n = run('Object.fromEntries(Object.entries(MF_LEX).map(([k, v]) => [k, v.length]))');
  assert.ok(n[2] >= 30 && n[3] >= 100 && n[4] >= 150 && n[5] >= 100 && n[6] >= 50, JSON.stringify(n));
});

for (const level of ['small', 'medium', 'large']) {
  test(`mots fléchés : grilles « ${level} » complètes et valides`, () => {
    const { rows, cols } = run(`MF_LEVELS.${level}`);
    for (const p of grids(level)) {
      assert.ok(p, 'une grille a pu être générée');
      assert.equal(p.kind.length, rows * cols);
      // première ligne et première colonne : que des définitions
      for (let c = 0; c < cols; c++) assert.equal(p.kind[c], 'C');
      for (let r = 0; r < rows; r++) assert.equal(p.kind[r * cols], 'C');
      // toutes les cases-lettres ont une lettre, les autres rien
      p.kind.forEach((k, i) => assert.equal(k === 'L', /^[A-Z]$/.test(p.sol[i]), 'case ' + i));
      // chaque mot : lettres de la solution = un mot du lexique, avec sa définition ; jamais deux fois le même mot
      const words = new Set();
      for (const s of p.slots) {
        const w = s.cells.map(i => p.sol[i]).join('');
        assert.ok(run(`MF_LEX[${w.length}].some(e => e.w === '${w}' && e.c === ${JSON.stringify(s.text)})`), 'mot inconnu : ' + w);
        assert.ok(!words.has(w), 'mot répété : ' + w);
        words.add(w);
        assert.ok(s.cells.length >= 2 && s.cells.length <= 5);
        // la définition est dans la case juste avant le mot (à gauche ou au-dessus)
        const first = s.cells[0];
        assert.equal(s.clueCell, s.dir === 'h' ? first - 1 : first - cols);
        assert.equal(p.kind[s.clueCell], 'C');
        // les cases du mot sont alignées
        s.cells.forEach((i, k) => assert.equal(i, first + k * (s.dir === 'h' ? 1 : cols)));
      }
      // chaque case-lettre appartient à un mot
      const covered = new Set(p.slots.flatMap(s => s.cells));
      p.kind.forEach((k, i) => { if (k === 'L') assert.ok(covered.has(i), 'case orpheline ' + i); });
      // le début d'un mot est toujours précédé d'une définition : pas de suite de 2 lettres ou plus sans définition
      const runs = run(`mfSlots(${JSON.stringify(p.kind)}, ${rows}, ${cols}).length`);
      assert.equal(runs, p.slots.length);
    }
  });
}

test('mots fléchés : peu de mots de 2 lettres (trop ambigus)', () => {
  for (const p of grids('medium')) {
    const two = p.slots.filter(s => s.cells.length === 2).length;
    assert.ok(two <= Math.ceil(p.slots.length * 0.2), two + ' sur ' + p.slots.length);
  }
});

test('mots fléchés : la génération est rapide', () => {
  const t0 = Date.now();
  for (const level of ['small', 'medium', 'large']) run(`(function(){ for (let i = 0; i < 5; i++) mfGenerate('${level}'); return 1; })()`);
  assert.ok(Date.now() - t0 < 4000, (Date.now() - t0) + ' ms');
});

test('mots fléchés : formats et scores', () => {
  assert.equal(run('mfFmt(75)'), '1:15');
  assert.equal(run('SC_GAMES.mots.fmt(600)'), '10:00');
  assert.deepEqual(Object.keys(run('SC_GAMES.mots.modes')), ['small', 'medium', 'large']);
  assert.ok(run('SC_ORDER').includes('mots'));
});
