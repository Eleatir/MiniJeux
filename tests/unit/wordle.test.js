const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

const g = load(['js/scores.js', 'js/settings.js', 'js/core.js',
  'js/games/wordle-words.js', 'js/games/wordle-dict.js', 'js/games/wordle.js']);
// comme dans le jeu : l'essai est en majuscules, la cible est normalisée (minuscules, sans accent)
const ev = (guess, target) => g.run(`wdEvaluate(${JSON.stringify(guess)}, normalize(${JSON.stringify(target)})).join(" ")`);

test('wordle : lettres bien placées, présentes et absentes', () => {
  assert.equal(ev('TABLE', 'TABLE'), 'correct correct correct correct correct');
  assert.equal(ev('ARBRE', 'TABLE'), 'present absent correct absent correct');   // A mal placé, R absent, B et E bien placés
  assert.equal(ev('XXXXX', 'TABLE'), 'absent absent absent absent absent');
});

test('wordle : les lettres en double ne sont colorées qu\'autant qu\'il en reste dans le mot', () => {
  // cible « ABCDE » : un seul A. Dans « AAXXX », le premier A est bien placé, le second doit rester absent.
  assert.equal(ev('AAXXX', 'ABCDE'), 'correct absent absent absent absent');
  // cible « XXABC »... le A mal placé n'est présent qu'une fois
  assert.equal(ev('AAXXX', 'XYAZW'), 'present absent present absent absent');
  // une lettre bien placée est servie avant une lettre simplement présente
  assert.equal(ev('LLAMA', 'ALLEE'), 'present correct present absent absent');
});

test('wordle : les accents sont ignorés', () => {
  assert.equal(ev('ÉTOILE', 'etoile'), 'correct correct correct correct correct correct');
  assert.equal(g.run('normalize("Écoute Çà")'), 'ecoute ca');
});

test('wordle : listes de mots à deviner cohérentes (longueur, sans doublon, minuscules sans accent)', () => {
  for (const n of [5, 6, 7]) {
    const words = g.run(`WD_WORDS[${n}]`);
    assert.ok(words.length >= 100, `assez de mots de ${n} lettres`);
    assert.equal(new Set(words).size, words.length, `doublons dans les mots de ${n} lettres`);
    for (const w of words) {
      assert.equal(w.length, n, `« ${w} » doit avoir ${n} lettres`);
      assert.match(w, /^[a-z]+$/, `« ${w} » doit être en minuscules sans accent`);
    }
  }
});

test('wordle : tous les mots à deviner sont dans le dictionnaire de validation', () => {
  for (const n of [5, 6, 7]) {
    const missing = g.run(`WD_WORDS[${n}].filter(w => !WD_DICT[${n}].has(w))`);
    assert.deepEqual(missing, [], `mots absents du dictionnaire (${n} lettres)`);
  }
});

test('wordle : le dictionnaire reconnaît de vrais mots et refuse les autres', () => {
  assert.equal(g.run('WD_DICT[5].has("table")'), true);
  assert.equal(g.run('WD_DICT[6].has("maison")'), true);
  assert.equal(g.run('WD_DICT[7].has("musique")'), true);
  assert.equal(g.run('WD_DICT[5].has("azert")'), false);
  assert.equal(g.run('WD_DICT[5].has("xxxxx")'), false);
  for (const n of [5, 6, 7]) assert.ok(g.run(`WD_DICT[${n}].size`) > 3000);
});

test('wordle : le dictionnaire ne contient que des mots de la bonne longueur', () => {
  for (const n of [5, 6, 7]) {
    const bad = g.run(`[...WD_DICT[${n}]].filter(w => w.length !== ${n} || !/^[a-z]+$/.test(w))`);
    assert.deepEqual(bad, []);
  }
});
