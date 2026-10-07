const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

const g = load(['js/scores.js', 'js/settings.js', 'js/core.js', 'js/storage.js', 'js/fx.js', 'js/games/solitaire.js']);

// Cartes : s = couleur (0 ♠, 1 ♥, 2 ♦, 3 ♣), r = rang (1 as … 13 roi)
const C = (s, r, up = true) => ({ s, r, up });
function setGame(state) {
  const base = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], moves: 0, won: false, draw: 1 };
  g.exec('sol = ' + JSON.stringify(Object.assign(base, state)));
}
const canMove = (sel, to, j) => g.run(`solCanMove(${JSON.stringify(sel)}, ${JSON.stringify(to)}, ${j})`);

test('solitaire : la donne a 52 cartes distinctes, 7 colonnes de 1 à 7 cartes, la dernière visible', () => {
  for (let i = 0; i < 20; i++) {
    const d = g.run('solDeal(3)');
    assert.deepEqual(d.tab.map(c => c.length), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(d.stock.length, 24);
    assert.equal(d.draw, 3);
    d.tab.forEach(col => col.forEach((c, k) => assert.equal(c.up, k === col.length - 1)));
    const all = [...d.stock, ...d.waste, ...d.tab.flat()];
    assert.equal(new Set(all.map(c => c.s * 20 + c.r)).size, 52);
  }
});

test('solitaire : sur une colonne, couleur alternée et rang décroissant', () => {
  setGame({ tab: [[C(1, 8)], [C(0, 7)], [C(2, 7)], [C(3, 7)], [], [], []] });   // 8♥ puis 7♠, 7♦, 7♣
  assert.equal(canMove({ from: 't', i: 1, n: 1 }, 't', 0), true, '7♠ (noir) sur 8♥ (rouge)');
  assert.equal(canMove({ from: 't', i: 3, n: 1 }, 't', 0), true, '7♣ (noir) sur 8♥ (rouge)');
  assert.equal(canMove({ from: 't', i: 2, n: 1 }, 't', 0), false, '7♦ (rouge) sur 8♥ (rouge) refusé');
  assert.equal(canMove({ from: 't', i: 0, n: 1 }, 't', 1), false, 'rang croissant refusé');
});

test('solitaire : seul un roi va sur une colonne vide', () => {
  setGame({ tab: [[C(0, 13)], [C(1, 12)], [], [], [], [], []] });
  assert.equal(canMove({ from: 't', i: 0, n: 1 }, 't', 2), true);
  assert.equal(canMove({ from: 't', i: 1, n: 1 }, 't', 2), false);
});

test('solitaire : on ne pose jamais sur une carte cachée, ni sur sa propre colonne', () => {
  setGame({ tab: [[C(1, 8, false)], [C(0, 7)], [], [], [], [], []] });
  assert.equal(canMove({ from: 't', i: 1, n: 1 }, 't', 0), false);
  setGame({ tab: [[C(1, 8), C(0, 7)], [], [], [], [], [], []] });
  assert.equal(canMove({ from: 't', i: 0, n: 1 }, 't', 0), false);
});

test('solitaire : fondations dans l\'ordre, une couleur par pile', () => {
  setGame({ tab: [[C(2, 1)], [C(2, 2)], [C(1, 2)], [], [], [], []] });
  assert.equal(canMove({ from: 't', i: 0, n: 1 }, 'f', 0), true, 'as sur pile vide');
  assert.equal(canMove({ from: 't', i: 1, n: 1 }, 'f', 0), false, 'un 2 ne démarre pas une pile');
  g.exec('sol.found[0] = [{ s: 2, r: 1, up: true }]');
  assert.equal(canMove({ from: 't', i: 1, n: 1 }, 'f', 0), true, '2♦ sur A♦');
  assert.equal(canMove({ from: 't', i: 2, n: 1 }, 'f', 0), false, '2♥ sur A♦ refusé (autre couleur)');
});

test('solitaire : une suite de plusieurs cartes ne peut pas aller sur une fondation', () => {
  setGame({ tab: [[C(2, 2), C(0, 1)], [], [], [], [], [], []] });
  assert.equal(canMove({ from: 't', i: 0, n: 2 }, 'f', 0), false);
});

test('solitaire : déplacer retourne la carte découverte et compte un coup', () => {
  setGame({ tab: [[C(3, 4, false), C(1, 1)], [], [], [], [], [], []] });
  g.exec('solMoveCore({ from: "t", i: 0, n: 1 }, "f", 0)');
  assert.deepEqual(g.run('sol.found[0].map(c => c.r)'), [1]);
  assert.equal(g.run('sol.tab[0][0].up'), true);
  assert.equal(g.run('sol.moves'), 1);
});

test('solitaire : victoire quand les 4 fondations sont complètes', () => {
  const found = [0, 1, 2, 3].map(s => Array.from({ length: 12 }, (_, k) => C(s, k + 1)));
  setGame({ found, tab: [[C(0, 13)], [C(1, 13)], [C(2, 13)], [C(3, 13)], [], [], []] });
  for (let i = 0; i < 4; i++) g.exec(`solMoveCore({ from: "t", i: ${i}, n: 1 }, "f", ${i})`);
  assert.equal(g.run('sol.won'), true);
});

test('solitaire : jouer au hasard conserve toujours les 52 cartes', () => {
  g.exec('sol = solDeal(1)');
  for (let step = 0; step < 600; step++) {
    g.exec(`(() => {
      const moves = [];
      const srcs = [['w', 0]].concat(sol.tab.map((_, i) => ['t', i]));
      for (const [z, i] of srcs) {
        const arr = solArr(z, i);
        const first = z === 't' ? arr.findIndex(c => c.up) : arr.length - 1;
        if (!arr.length || first < 0) continue;
        for (let idx = first; idx < arr.length; idx++) {
          const sel = { from: z, i, n: arr.length - idx };
          for (let j = 0; j < 7; j++) if (solCanMove(sel, 't', j)) moves.push([sel, 't', j]);
          if (sel.n === 1) for (let j = 0; j < 4; j++) if (solCanMove(sel, 'f', j)) moves.push([sel, 'f', j]);
        }
      }
      if (moves.length && Math.random() < 0.8) { const m = moves[Math.floor(Math.random() * moves.length)]; solMoveCore(m[0], m[1], m[2]); }
      else if (sol.stock.length) { const c = sol.stock.pop(); c.up = true; sol.waste.push(c); }
      else if (sol.waste.length) { sol.stock = sol.waste.reverse(); sol.waste = []; sol.stock.forEach(c => c.up = false); }
    })()`);
    const total = g.run('[...sol.stock, ...sol.waste, ...sol.found.flat(), ...sol.tab.flat()].map(c => c.s * 20 + c.r)');
    assert.equal(total.length, 52, `étape ${step}`);
    assert.equal(new Set(total).size, 52, `doublon à l'étape ${step}`);
  }
});

test('solitaire : coup utile détecté (as en pioche, déplacement qui dévoile une carte)', () => {
  setGame({ tab: [[C(0, 5)], [C(2, 9)], [], [], [], [], []], stock: [C(1, 1, false)] });
  assert.equal(g.run('solHasUsefulMove()'), true, 'un as dans la pioche peut monter');
  setGame({ tab: [[C(0, 9, false), C(1, 8)], [C(3, 9)], [], [], [], [], []] });
  assert.equal(g.run('solHasUsefulMove()'), true, '8♥ sur 9♣ dévoile une carte');
});

test('solitaire : blocage détecté quand plus aucun coup utile n\'existe', () => {
  setGame({ tab: [[C(0, 5)], [C(1, 5)], [], [], [], [], []] });
  assert.equal(g.run('solHasUsefulMove()'), false);
});

test('solitaire : un coup qui ne fait que déplacer une carte déjà bien rangée n\'est pas « utile »', () => {
  setGame({ tab: [[C(0, 9), C(1, 8)], [C(3, 9)], [], [], [], [], []] });
  // 8♥ est déjà sur 9♠ ; la déplacer sur 9♣ ne dévoile rien
  assert.equal(g.run('solHasUsefulMove()'), false);
});

test('solitaire : complétion automatique — vraie quand la donne se termine par de simples montées', () => {
  const found = [10, 9, 11, 8].map((n, s) => Array.from({ length: n }, (_, k) => C(s, k + 1)));
  setGame({ found, tab: [[C(3, 13), C(3, 12), C(3, 11), C(3, 10), C(3, 9)], [C(1, 13), C(1, 12), C(1, 11), C(1, 10)], [C(0, 13), C(0, 12), C(0, 11)], [C(2, 13), C(2, 12)], [], [], []] });
  assert.equal(g.run('solAutoRun()'), true);
  assert.equal(g.run('sol.won'), true);
});

test('solitaire : complétion automatique — fausse quand une carte en bloque une autre', () => {
  setGame({ found: [[C(0, 1)], [], [], []], tab: [[C(0, 3), C(0, 4)], [C(0, 2)], [], [], [], [], []] });
  // 2♠ est libre ; 3♠ est sous 4♠ qui ne peut pas monter avant 3♠ : bloqué
  assert.equal(g.run('solAutoRun()'), false);
});

test('solitaire : la complétion automatique pioche pour atteindre les cartes de la pioche', () => {
  const found = [12, 13, 13, 13].map((n, s) => Array.from({ length: n }, (_, k) => C(s, k + 1)));
  setGame({ found, stock: [C(0, 13, false)], tab: [[], [], [], [], [], [], []] });
  assert.equal(g.run('solAutoRun()'), true);
});

test('solitaire : même couleur = pas un coup utile (pioche comme colonnes)', () => {
  setGame({ tab: [[C(0, 6)], [], [], [], [], [], []], stock: [C(3, 5, false)] });          // 5♣ sur 6♠ : noir sur noir
  assert.equal(g.run('solHasUsefulMove()'), false);
  setGame({ tab: [[C(3, 4, false), C(1, 8)], [C(2, 9)], [], [], [], [], []] });          // 8♥ sur 9♦ : rouge sur rouge
  assert.equal(g.run('solHasUsefulMove()'), false);
});
