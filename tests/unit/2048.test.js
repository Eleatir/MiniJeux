const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

const g = load(['js/scores.js', 'js/settings.js', 'js/core.js', 'js/games/2048.js']);
const slide = line => g.run('tfSlide(' + JSON.stringify(line) + ')');

test('2048 : glisser sans fusion', () => {
  assert.deepEqual(slide([0, 2, 0, 4]).line, [2, 4, 0, 0]);
  assert.equal(slide([0, 2, 0, 4]).gain, 0);
});

test('2048 : fusionner deux tuiles identiques et compter les points', () => {
  const r = slide([2, 2, 0, 0]);
  assert.deepEqual(r.line, [4, 0, 0, 0]);
  assert.equal(r.gain, 4);
});

test('2048 : une tuile ne fusionne qu\'une fois par coup (2-2-2-2 donne 4-4, pas 8)', () => {
  const r = slide([2, 2, 2, 2]);
  assert.deepEqual(r.line, [4, 4, 0, 0]);
  assert.equal(r.gain, 8);
});

test('2048 : on fusionne en partant du bord vers lequel on glisse', () => {
  assert.deepEqual(slide([2, 2, 2, 0]).line, [4, 2, 0, 0]);
  assert.deepEqual(slide([4, 0, 2, 2]).line, [4, 4, 0, 0]);
});

test('2048 : une ligne figée est signalée comme non déplacée', () => {
  assert.equal(slide([2, 4, 8, 16]).moved, false);
  assert.equal(slide([2, 4, 0, 0]).moved, false);
  assert.equal(slide([0, 2, 4, 8]).moved, true);
});

test('2048 : les trajets des tuiles servent à l\'animation (départ, arrivée, fusion)', () => {
  const r = slide([2, 0, 2, 4]);
  assert.deepEqual(r.moves, [{ from: 0, to: 0, v: 2 }, { from: 2, to: 0, v: 2 }, { from: 3, to: 1, v: 4 }]);
  assert.deepEqual(r.merged, [0]);
});

test('2048 : la somme des tuiles est conservée par un glissement', () => {
  for (let i = 0; i < 200; i++) {
    const line = Array.from({ length: 4 }, () => [0, 0, 2, 4, 8][Math.floor(Math.random() * 5)]);
    const r = slide(line);
    assert.equal(r.line.reduce((a, b) => a + b, 0), line.reduce((a, b) => a + b, 0), JSON.stringify(line));
    assert.equal(r.line.length, 4);
  }
});

test('2048 : fin de partie détectée uniquement sans case vide ni fusion possible', () => {
  const can = board => { g.exec('tfBoard = ' + JSON.stringify(board)); return g.run('tfCanMove()'); };
  assert.equal(can([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]), true);   // case vide
  assert.equal(can([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]), true);   // fusion possible
  assert.equal(can([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 8]]), false);  // bloqué
});
