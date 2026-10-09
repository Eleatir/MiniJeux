const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load } = require('./helpers');

// Logique du serveur (Apps Script) : chargée telle quelle, sans les services Google
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'apps-script.gs'), 'utf8'), ctx);
const clean = o => JSON.parse(JSON.stringify(o));
const PID = 'abcdefghij123456', OTHER = 'zzzzzzzzzz999999';
const ok = o => ctx.lbValidate(Object.assign({ game: 'snake', mode: 'medium', v: 40, n: 'ABC', d: 1, pid: PID }, o));

test('serveur : accepte un score valide', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ok({}))), { game: 'snake', mode: 'medium', v: 40, n: 'ABC', d: 1, pid: PID });
});

test('serveur : refuse jeu, mode, score, nom ou identifiant invalides', () => {
  [{ game: 'tetris' }, { game: '__proto__' }, { mode: 'nope' }, { v: -1 }, { v: 0 }, { v: 1.5 }, { v: 1e9 }, { v: 'x' },
   { n: 'ab' }, { n: 'ABCD' }, { n: '<b>' }, { pid: 'court' }, { pid: 'AAAAAAAAAAAAAAAA' }].forEach(o => assert.equal(ok(o), null, JSON.stringify(o)));
  assert.equal(ctx.lbValidate(null), null);
});

test('serveur : mode numérique accepté (Wordle, Solitaire)', () => {
  assert.ok(ok({ game: 'wordle', mode: 5, v: 3040 }));
  assert.ok(ok({ game: 'solitaire', mode: '3', v: 120 }));
});

test('serveur : classement trié selon le jeu, limité à 10, « mine » sans fuite de pid', () => {
  const rows = [];
  for (let i = 1; i <= 12; i++) rows.push({ game: 'snake', mode: 'medium', v: i * 10, n: 'AAA', d: i, pid: i === 12 ? PID : OTHER });
  rows.push({ game: 'snake', mode: 'fast', v: 999, n: 'ZZZ', d: 1, pid: OTHER });
  const top = JSON.parse(JSON.stringify(ctx.lbTop(rows, 'snake', 'medium', PID)));
  assert.equal(top.length, 10);
  assert.equal(top[0].v, 120); assert.equal(top[0].mine, true); assert.equal(top[1].mine, false);
  assert.ok(top.every(e => !('pid' in e)));
  const asc = JSON.parse(JSON.stringify(ctx.lbTop([{ game: 'sudoku', mode: 'easy', v: 300, n: 'AAA', d: 1, pid: OTHER }, { game: 'sudoku', mode: 'easy', v: 200, n: 'BBB', d: 2, pid: OTHER }], 'sudoku', 'easy')));
  assert.deepEqual(asc.map(e => e.v), [200, 300]);
});

test('serveur : un renvoi du même score n\'est pas un doublon accepté deux fois', () => {
  const r = ok({});
  assert.equal(ctx.lbIsDuplicate([r], r), true);
  assert.equal(ctx.lbIsDuplicate([r], ok({ v: 41 })), false);
});

/* ── client ── */
let g;
const FILES = ['js/scores.js', 'js/config.js', 'js/online.js'];
beforeEach(() => { g = load(FILES); g.exec('Online.url = () => ""'); });   // indépendant de la vraie adresse de js/config.js

test('client : sans adresse configurée, rien n\'est envoyé et « Tous » indique que c\'est désactivé', async () => {
  assert.equal(g.run('Online.enabled()'), false);
  assert.deepEqual(clean(await vm.runInContext('Online.top("snake","medium")', g.ctx)), { disabled: true, entries: [] });
  assert.deepEqual(clean(await vm.runInContext('Online.submit("snake","medium",5,"ABC",1)', g.ctx)), { disabled: true });
});

test('client : l\'identifiant joueur est créé une fois puis conservé', () => {
  const a = g.run('Online.playerId()');
  assert.match(a, /^[a-z0-9]{16}$/);
  assert.equal(g.run('Online.playerId()'), a);
});

function online(fetchImpl) {
  const gg = load(FILES, { fetch: fetchImpl, LEADERBOARD_URL: 'https://example.test/exec', AbortController });
  gg.exec('Online.url = () => "https://example.test/exec"');
  return gg;
}

test('client : lecture du classement, nettoyage des entrées et cache', async () => {
  let calls = 0;
  const gg = online(async url => { calls++; assert.match(url, /action=top&game=snake&mode=medium&pid=/);
    return { ok: true, json: async () => ({ ok: true, entries: [{ n: 'AB<', v: '50', d: 5, mine: true }] }) }; });
  const r = clean(await vm.runInContext('Online.top("snake","medium")', gg.ctx));
  assert.deepEqual(r.entries.map(e => [e.n, e.v, e.mine]), [['AB', 50, true]]);
  await vm.runInContext('Online.top("snake","medium")', gg.ctx);
  assert.equal(calls, 1);
});

test('client : réseau coupé → erreur signalée, et les anciennes données restent affichées', async () => {
  let fail = false;
  const gg = online(async () => { if (fail) throw new Error('offline'); return { ok: true, json: async () => ({ ok: true, entries: [{ n: 'AAA', v: 9, d: 1 }] }) }; });
  await vm.runInContext('Online.top("snake","medium")', gg.ctx);
  fail = true;
  const r = clean(await vm.runInContext('Online.top("snake","medium", true)', gg.ctx));
  assert.equal(r.error, true); assert.equal(r.entries.length, 1);
});

test('client : un envoi raté est mis en attente puis renvoyé, sans doublon', async () => {
  let fail = true; const posted = [];
  const gg = online(async (url, o) => { if (fail) throw new Error('offline'); posted.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ ok: true }) }; });
  const r = clean(await vm.runInContext('Online.submit("snake","medium",42,"ABC",7)', gg.ctx));
  assert.deepEqual(r, { queued: true });
  assert.equal(await vm.runInContext('Online.flush()', gg.ctx), 0);
  fail = false;
  assert.equal(await vm.runInContext('Online.flush()', gg.ctx), 1);
  assert.equal(posted.length, 1); assert.equal(posted[0].v, 42);
  assert.equal(await vm.runInContext('Online.flush()', gg.ctx), 0);
});

test('client : les scores déjà gagnés sont envoyés une seule fois à l\'activation du classement', async () => {
  const posted = [];
  const gg = online(async (url, o) => { posted.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ ok: true }) }; });
  [10, 50, 30, 20, 40].forEach(v => gg.exec(`scAdd('snake', 'medium', ${v}, 'CED')`));
  assert.equal(gg.run('Online.syncLocal()'), 3);
  assert.equal(gg.run('Online.syncLocal()'), 0);
  assert.equal(await vm.runInContext('Online.flush()', gg.ctx), 3);
  assert.deepEqual(posted.map(p => p.v), [50, 40, 30]);
  assert.ok(posted.every(p => p.n === 'CED' && p.game === 'snake' && p.d > 0));
});
