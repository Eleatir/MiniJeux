const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

let g;
beforeEach(() => { g = load(['js/scores.js', 'js/settings.js', 'js/storage.js']); });

// Remplit le tableau Snake/moyen (plus haut = meilleur) ou Démineur/moyen (plus bas = meilleur)
const add = (game, mode, v, name = 'AAA') => g.run(`scAdd(${JSON.stringify(game)}, ${JSON.stringify(mode)}, ${v}, ${JSON.stringify(name)})`);
const values = (game, mode) => g.run(`scList(${JSON.stringify(game)}, ${JSON.stringify(mode)}).map(e => e.v)`);

test('scores : le plus haut score est premier (Snake), le plus court temps est premier (Démineur)', () => {
  [10, 50, 30].forEach(v => add('snake', 'medium', v));
  assert.deepEqual(values('snake', 'medium'), [50, 30, 10]);
  [3000, 1200, 2100].forEach(v => add('minesweeper', 'easy', v));
  assert.deepEqual(values('minesweeper', 'easy'), [1200, 2100, 3000]);
});

test('scores : seuls les 10 meilleurs sont gardés', () => {
  for (let v = 1; v <= 15; v++) add('snake', 'medium', v);
  assert.deepEqual(values('snake', 'medium'), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6]);
});

test('scores : rang d\'un nouveau score, ex æquo derrière l\'existant, hors top = -1', () => {
  [100, 80, 60].forEach(v => add('snake', 'medium', v));
  assert.equal(g.run('scRank("snake", "medium", 90)'), 1);
  assert.equal(g.run('scRank("snake", "medium", 100)'), 1);   // à égalité, le premier arrivé garde sa place
  assert.equal(g.run('scRank("snake", "medium", 5)'), 3);     // tableau pas plein : on entre en dernier
  for (let v = 1; v <= 7; v++) add('snake', 'medium', 200 + v);   // le tableau est plein
  assert.equal(g.run('scRank("snake", "medium", 1)'), -1);
});

test('scores : meilleur score et tableaux séparés par jeu et par niveau', () => {
  assert.equal(g.run('scBest("snake", "medium")'), null);
  add('snake', 'medium', 40);
  add('snake', 'fast', 90);
  assert.equal(g.run('scBest("snake", "medium")'), 40);
  assert.equal(g.run('scBest("snake", "fast")'), 90);
  assert.equal(g.run('scBest("2048", "all")'), null);
});

test('scores : les scores sont sauvegardés dans localStorage et relus', () => {
  add('snake', 'medium', 77, 'ZED');
  assert.match(g.storage.getItem('minijeux.scores.v1'), /ZED/);
  const g2 = load(['js/scores.js', 'js/settings.js', 'js/storage.js']);
  g2.storage.setItem('minijeux.scores.v1', g.storage.getItem('minijeux.scores.v1'));
  assert.equal(g2.run('scBest("snake", "medium")'), 77);
});

test('scores : un nom est toujours 3 lettres majuscules (jamais de HTML venant d\'un fichier)', () => {
  assert.deepEqual(g.run('scClean({ n: "<B>x/Z", v: "12", d: 5 })'), { n: 'BZ', v: 12, d: 5, id: '5-BZ' });   // seules les majuscules A-Z sont gardées
  assert.equal(g.run('scClean({ n: "ABCDEF", v: 1, d: 1 }).n'), 'ABC');
  assert.equal(g.run('scClean({}).n'), '???');
  assert.equal(g.run('scClean(null).v'), 0);
});

test('scores : le dernier nom saisi est proposé, AAA par défaut ou si invalide', () => {
  assert.equal(g.run('scLastName()'), 'AAA');
  g.storage.setItem('minijeux.name', 'KIM');
  assert.equal(g.run('scLastName()'), 'KIM');
  g.storage.setItem('minijeux.name', 'k<m');
  assert.equal(g.run('scLastName()'), 'AAA');
});

test('scores : l\'import fusionne sans doublon et respecte le tri et la limite', () => {
  add('snake', 'medium', 50, 'AAA');
  const file = { app: 'minijeux', version: 1, scores: { snake: { medium: [{ n: 'BBB', v: 80, d: 1 }, { n: 'AAA', v: 50, d: 0 }] } } };
  const existing = g.run('scList("snake", "medium")[0]');
  file.scores.snake.medium[1] = { n: existing.n, v: existing.v, d: existing.d };   // exactement la même entrée : doublon
  const added = g.run('scImportData(' + JSON.stringify(file) + ')');
  assert.equal(added, 1);
  assert.deepEqual(values('snake', 'medium'), [80, 50]);
});

test('scores : un fichier d\'import invalide est refusé', () => {
  assert.throws(() => g.run('scImportData({ x: 1 })'));
  assert.throws(() => g.run('scImportData(null)'));
  assert.throws(() => g.run('scImportData({ app: "autre", scores: {} })'));
});

test('scores : formats d\'affichage', () => {
  assert.equal(g.run('SC_GAMES.minesweeper.fmt(1234)'), '12.34 s');
  assert.equal(g.run('SC_GAMES.wordle.fmt(3012)'), '3 essais · 12 s');
  assert.equal(g.run('SC_GAMES.wordle.fmt(1005)'), '1 essai · 5 s');
  assert.equal(g.run('SC_GAMES.solitaire.fmt(88)'), '88 coups');
});

test('stockage : une partie se sauvegarde, se reprend et s\'efface', () => {
  assert.equal(g.run('Save.has("solitaire")'), false);
  g.exec('Save.store("solitaire", { moves: 3 })');
  assert.deepEqual(g.run('Save.load("solitaire")'), { moves: 3 });
  assert.equal(g.run('Save.has("solitaire")'), true);
  g.exec('Save.store("solitaire", null)');
  assert.equal(g.run('Save.has("solitaire")'), false);
});

test('stockage : les statistiques comptent les parties et retiennent le dernier niveau', () => {
  g.exec('Stats.played("snake", "fast"); Stats.played("snake", "slow")');
  assert.equal(g.run('Stats.count("snake")'), 2);
  assert.equal(g.run('Stats.mode("snake")'), 'slow');
  assert.equal(g.run('Stats.count("wordle")'), 0);
});

test('réglages : valeurs par défaut (sons coupés) et mémorisation', () => {
  assert.equal(g.run('Settings.get("sound")'), false);
  assert.equal(g.run('Settings.get("motion")'), true);
  g.exec('Settings.set("sound", true)');
  assert.match(g.storage.getItem('minijeux.settings.v1'), /"sound":true/);
});
