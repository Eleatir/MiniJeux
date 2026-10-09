/* ════════════════════════════════════════════
   MiniJeux — classement général (Google Apps Script + Google Sheet)
   Mise en place : voir « Classement général » dans le README.
   La logique (validation, tri, doublons) est écrite en fonctions pures, testées par tests/unit/leaderboard.test.js.
   Les identifiants joueurs (pid) restent côté serveur : le classement n'en renvoie qu'un indicateur « mine ».
════════════════════════════════════════════ */
var LB_GAMES = {
  wordle:      { dir: 'asc',  max: 7000,   modes: ['5', '6', '7'] },
  minesweeper: { dir: 'asc',  max: 999999, modes: ['easy', 'medium', 'hard'] },
  snake:       { dir: 'desc', max: 100000, modes: ['slow', 'medium', 'fast'] },
  sudoku:      { dir: 'asc',  max: 360000, modes: ['easy', 'medium', 'hard'] },
  mots:        { dir: 'asc',  max: 360000, modes: ['small', 'medium', 'large'] },
  solitaire:   { dir: 'asc',  max: 100000, modes: ['1', '3'] }
};
var LB_TOP = 10;

// Renvoie la ligne nettoyée { game, mode, v, n, d, pid } ou null si elle est invalide
function lbValidate(p) {
  if (!p || typeof p !== 'object') return null;
  var cfg = LB_GAMES.hasOwnProperty(p.game) ? LB_GAMES[p.game] : null;
  if (!cfg) return null;
  var mode = String(p.mode);
  if (cfg.modes.indexOf(mode) < 0) return null;
  var v = Number(p.v);
  if (!isFinite(v) || v <= 0 || v > cfg.max || Math.floor(v) !== v) return null;
  var n = String(p.n || '');
  if (!/^[A-Z]{3}$/.test(n)) return null;
  var pid = String(p.pid || '');
  if (!/^[a-z0-9]{12,32}$/.test(pid)) return null;
  var d = Number(p.d);
  if (!isFinite(d) || d <= 0) d = 0;
  return { game: p.game, mode: mode, v: v, n: n, d: d, pid: pid };
}

// Vrai si la même ligne (même joueur, même score, même date) est déjà présente : un renvoi ne crée pas de doublon
function lbIsDuplicate(rows, r) {
  return rows.some(function (x) { return x.pid === r.pid && x.game === r.game && x.mode === r.mode && x.v === r.v && x.d === r.d; });
}

// Les meilleures lignes d'un tableau, avec l'indicateur « mine » pour le joueur qui demande (sans jamais exposer les pid)
function lbTop(rows, game, mode, pid) {
  var cfg = LB_GAMES.hasOwnProperty(game) ? LB_GAMES[game] : null;
  if (!cfg) return [];
  return rows
    .filter(function (r) { return r.game === game && String(r.mode) === String(mode); })
    .sort(function (a, b) { return (cfg.dir === 'asc' ? a.v - b.v : b.v - a.v) || (a.d - b.d); })
    .slice(0, LB_TOP)
    .map(function (r) { return { n: r.n, v: r.v, d: r.d, mine: !!pid && r.pid === pid }; });
}

/* ── partie Google (non testée en local) ── */
function lbSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('scores') || ss.insertSheet('scores');
  if (sh.getLastRow() === 0) sh.appendRow(['game', 'mode', 'v', 'n', 'd', 'pid']);
  return sh;
}
function lbRows_() {
  var sh = lbSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 6).getValues().map(function (r) {
    return { game: String(r[0]), mode: String(r[1]), v: Number(r[2]), n: String(r[3]), d: Number(r[4]), pid: String(r[5]) };
  });
}
function lbJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.action !== 'top') return lbJson_({ ok: false, error: 'action' });
  return lbJson_({ ok: true, entries: lbTop(lbRows_(), q.game, q.mode, q.pid) });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p = JSON.parse(e.postData.contents);
    var r = p && p.action === 'submit' ? lbValidate(p) : null;
    if (!r) return lbJson_({ ok: false, error: 'invalid' });
    if (!lbIsDuplicate(lbRows_(), r)) lbSheet_().appendRow([r.game, r.mode, r.v, r.n, r.d, r.pid]);
    return lbJson_({ ok: true });
  } catch (err) {
    return lbJson_({ ok: false, error: 'invalid' });
  } finally { lock.releaseLock(); }
}
