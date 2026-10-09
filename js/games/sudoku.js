/* ════════════════════════════════════════════
   SUDOKU
   Grille 9×9 : chaque ligne, colonne et bloc 3×3 contient une fois les chiffres 1 à 9.
   Les grilles sont générées à la volée et n'ont toujours qu'une seule solution.
════════════════════════════════════════════ */
const SD_LEVELS = { easy: 40, medium: 32, hard: 26 };   // nombre de cases données au départ
const SD_PENALTY = 30;                                   // secondes ajoutées au score par indice demandé
const SD_MAX_ERRORS = 3;                                 // une partie est perdue à la 3e erreur (chiffre qui n'est pas celui de la solution)

/* ── logique pure (testée sans navigateur) ── */

// Les 20 cases qui partagent une ligne, une colonne ou un bloc avec chaque case
const SD_PEERS = (() => {
  const peers = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9, set = new Set();
    for (let k = 0; k < 9; k++) { set.add(r * 9 + k); set.add(k * 9 + c); }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) set.add((br + dr) * 9 + bc + dc);
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
})();

const sdRow = i => Math.floor(i / 9), sdCol = i => i % 9;
const sdBox = i => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

function sdShuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Compte les solutions d'une grille (0 = case vide), en s'arrêtant à `limit`. Ne modifie pas la grille donnée.
function sdCount(grid, limit) {
  const g = grid.slice(), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  const empties = [];
  for (let i = 0; i < 81; i++) {
    if (g[i]) { const b = 1 << g[i]; rows[sdRow(i)] |= b; cols[sdCol(i)] |= b; boxes[sdBox(i)] |= b; }
    else empties.push(i);
  }
  let count = 0;
  (function dfs() {
    if (count >= limit) return;
    let best = -1, bestMask = 0, bestN = 10;
    for (const i of empties) {                     // on part de la case qui a le moins de possibilités
      if (g[i]) continue;
      const m = ~(rows[sdRow(i)] | cols[sdCol(i)] | boxes[sdBox(i)]) & 0x3fe;
      let n = 0;
      for (let x = m; x; x &= x - 1) n++;
      if (n < bestN) { best = i; bestMask = m; bestN = n; if (n <= 1) break; }
    }
    if (best < 0) { count++; return; }
    if (bestN === 0) return;
    const r = sdRow(best), c = sdCol(best), b = sdBox(best);
    for (let v = 1; v <= 9 && count < limit; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      dfs();
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
  })();
  return count;
}

// Grille complète valide, tirée au hasard
function sdFill(rand) {
  const g = Array(81).fill(0), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  (function place(i) {
    if (i === 81) return true;
    const r = sdRow(i), c = sdCol(i), b = sdBox(i);
    for (const v of sdShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)) {
      const bit = 1 << v;
      if ((rows[r] | cols[c] | boxes[b]) & bit) continue;
      g[i] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (place(i + 1)) return true;
      g[i] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  })(0);
  return g;
}

// Une grille à trou(s) avec une solution unique : on retire des cases (par paires symétriques)
// tant que la solution reste unique. Plus il reste peu de cases données, plus c'est difficile.
function sdGenerate(level, rand = Math.random) {
  const target = SD_LEVELS[level];
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {       // on réessaie si on n'atteint pas assez de cases vides
    const solution = sdFill(rand), puzzle = solution.slice();
    let givens = 81;
    for (const i of sdShuffle([...Array(41).keys()], rand)) {
      const j = 80 - i, cells = i === j ? [i] : [i, j];
      if (givens - cells.length < target) continue;
      const saved = cells.map(c => puzzle[c]);
      cells.forEach(c => { puzzle[c] = 0; });
      if (sdCount(puzzle, 2) === 1) givens -= cells.length;
      else cells.forEach((c, k) => { puzzle[c] = saved[k]; });
    }
    if (!best || givens < best.givens) best = { puzzle, solution, givens };
    if (givens <= target + 1) break;
  }
  return best;
}

// Cases en conflit : même chiffre qu'une case de la même ligne, colonne ou bloc
function sdConflicts(grid) {
  const bad = new Set();
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue;
    for (const p of SD_PEERS[i]) if (grid[p] === grid[i]) { bad.add(i); break; }
  }
  return bad;
}

// « Plus d'erreur possible » : chaque case encore vide n'a plus qu'un seul chiffre candidat (compte tenu des cases justes).
// Tant qu'un chiffre faux est posé, la fin automatique ne se déclenche pas : c'est au joueur de le corriger.
function sdForced(grid, solution) {
  if (grid.some((v, i) => v && v !== solution[i])) return false;
  const ok = grid;
  if (ok.every(Boolean)) return false;
  for (let i = 0; i < 81; i++) {
    if (ok[i]) continue;
    let seen = 0;
    for (const p of SD_PEERS[i]) if (ok[p]) seen |= 1 << ok[p];
    const cand = ~seen & 0x3fe;
    if (cand === 0 || (cand & (cand - 1)) !== 0) return false;     // 0 ou plusieurs candidats
  }
  return true;
}

const sdFmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

/* ── partie ── */
let sd = null, sdClock = null, sdAutoTimer = null;

function sdNewState(level) {
  const g = sdGenerate(level);
  return {
    level, puzzle: g.puzzle, solution: g.solution, grid: g.puzzle.slice(), notes: Array(81).fill(0),
    hints: 0, errors: 0, elapsed: 0, started: false, won: false, lost: false, auto: false, sel: -1, noteMode: false, hist: []
  };
}

function initSudoku(saved) {
  sdStop();
  const sel = document.getElementById('sdLevel');
  if (saved) sel.value = saved.level;
  sd = saved ? Object.assign(saved, { hist: [], sel: -1, won: false, lost: false, auto: false, errors: saved.errors || 0 }) : sdNewState(sel.value);
  const banner = document.getElementById('sdBanner');
  banner.className = 'banner'; banner.textContent = '';
  document.getElementById('sdReset').onclick = () => { document.activeElement.blur(); confirmAbandon(() => initSudoku(), 'Nouvelle grille'); };
  sel.onchange = () => { sel.blur(); confirmChange(sel, sd.level, () => initSudoku(), 'Nouvelle grille'); };
  const grid = document.getElementById('sdGrid');
  grid.onclick = e => { const c = e.target.closest('.sd-cell'); if (c) sdSelect(+c.dataset.i); };
  document.getElementById('sdPad').onclick = e => { const b = e.target.closest('[data-n]'); if (b) sdEnter(+b.dataset.n); };
  document.getElementById('sdTools').onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    ({ notes: sdToggleNotes, erase: sdErase, undo: sdUndo, hint: sdHint })[b.dataset.a]();
  };
  if (sd.started) sdClockStart();
  sdShowBest();
  sdRender();
}

function sdShowBest() {
  const el = document.getElementById('sdBest');
  if (!el) return;
  const best = scBest('sudoku', sd.level);
  el.textContent = best === null ? '—' : sdFmt(best);
}

function sdClockStart() {
  if (sdClock || sd.won) return;
  sdClock = setInterval(() => { if (!document.hidden && !sd.won) { sd.elapsed++; sdShowTime(); } }, 1000);
}
function sdClockStop() { clearInterval(sdClock); sdClock = null; }
function sdStop() { sdClockStop(); clearInterval(sdAutoTimer); sdAutoTimer = null; }
const sdLocked = () => sd.won || sd.lost || sd.auto;
function sdShowTime() {
  const el = document.getElementById('sdTime');
  if (el) el.textContent = sdFmt(sd.elapsed);
}

function sdSelect(i) { sd.sel = i; sdRender(); }

// Mémorise l'état pour « Annuler »
function sdPush() {
  sd.hist.push({ grid: sd.grid.slice(), notes: sd.notes.slice() });
  if (sd.hist.length > 300) sd.hist.shift();
}

function sdStarted() {
  if (!sd.started) { sd.started = true; Stats.played('sudoku', sd.level); }
  sdClockStart();
}

// Pose un chiffre dans la case choisie (ou une note en mode notes). Même chiffre deux fois = efface.
function sdEnter(v) {
  if (sdLocked() || sd.sel < 0 || sd.puzzle[sd.sel]) return;
  const i = sd.sel;
  sdStarted();
  if (sd.noteMode) {
    if (sd.grid[i]) return;
    sdPush();
    sd.notes[i] ^= 1 << v;
    Sfx.play('tick');
  } else {
    sdPush();
    if (sd.grid[i] === v) sd.grid[i] = 0;
    else {
      sd.grid[i] = v; sd.notes[i] = 0;
      for (const p of SD_PEERS[i]) sd.notes[p] &= ~(1 << v);      // le chiffre disparaît des notes de ses voisines
      if (v !== sd.solution[i]) { sd.errors++; Sfx.play('bad'); }   // erreur : le chiffre n'est pas celui de la solution
      else Sfx.play('place');
    }
  }
  sdAfterChange();
}

function sdErase() {
  if (sdLocked() || sd.sel < 0 || sd.puzzle[sd.sel]) return;
  const i = sd.sel;
  if (!sd.grid[i] && !sd.notes[i]) return;
  sdPush();
  sd.grid[i] = 0; sd.notes[i] = 0;
  sdAfterChange();
}

function sdToggleNotes() { sd.noteMode = !sd.noteMode; sdRender(); }

function sdUndo() {
  if (sdLocked() || !sd.hist.length) return;
  const h = sd.hist.pop();
  sd.grid = h.grid; sd.notes = h.notes;
  sdAfterChange(true);
}

// Indice : remplit la case choisie, sinon une case vide ou fausse au hasard. Coûte SD_PENALTY secondes.
function sdHint() {
  if (sdLocked()) return;
  const wrong = i => !sd.puzzle[i] && sd.grid[i] !== sd.solution[i];
  let i = sd.sel;
  if (i < 0 || !wrong(i)) {
    const options = [...Array(81).keys()].filter(wrong);
    if (!options.length) return;
    i = options[Math.floor(Math.random() * options.length)];
  }
  sdStarted();
  sdPush();
  sd.grid[i] = sd.solution[i]; sd.notes[i] = 0;
  for (const p of SD_PEERS[i]) sd.notes[p] &= ~(1 << sd.grid[i]);
  sd.sel = i; sd.hints++;
  Sfx.play('good');
  sdAfterChange();
}

function sdAfterChange(isUndo) {
  if (!isUndo && sd.errors >= SD_MAX_ERRORS) { sdLose(); sdRender(); return; }
  if (!isUndo && sd.grid.every((v, i) => v === sd.solution[i])) { sdWin(); sdRender(); return; }
  sdRender();
  if (sdForced(sd.grid, sd.solution)) sdAutoComplete();
}

// Plus aucune erreur possible : la grille se termine toute seule, case par case
function sdAutoComplete() {
  sd.auto = true; sd.sel = -1;
  sdClockStop();
  const b = document.getElementById('sdBanner');
  b.className = 'banner win'; b.textContent = 'Plus d\'erreur possible : la grille se termine toute seule…';
  const fill = () => {
    const i = sd.grid.findIndex((v, k) => v !== sd.solution[k]);
    if (i < 0) { clearInterval(sdAutoTimer); sdAutoTimer = null; sd.auto = false; sdWin(); sdRender(); return; }
    sd.grid[i] = sd.solution[i]; sd.notes[i] = 0;
    Sfx.play('place');
    sdRender();
  };
  clearInterval(sdAutoTimer);
  sdAutoTimer = setInterval(fill, motionOK() ? 90 : 10);
}

function sdLose() {
  sd.lost = true; sd.sel = -1;
  sdClockStop();
  const b = document.getElementById('sdBanner');
  b.className = 'banner lose';
  b.textContent = SD_MAX_ERRORS + ' erreurs : partie perdue. Lance une nouvelle grille !';
  Sfx.play('lose');
}

function sdScore() { return sd.elapsed + sd.hints * SD_PENALTY; }

function sdWin() {
  sd.won = true; sd.sel = -1;
  sdClockStop();
  const b = document.getElementById('sdBanner');
  b.className = 'banner win';
  b.textContent = 'Bravo, grille terminée en ' + sdFmt(sd.elapsed) + (sd.hints ? ' + ' + sd.hints + ' × ' + SD_PENALTY + ' s d\'indices = ' + sdFmt(sdScore()) : '') + ' !';
  Fx.confetti(); Sfx.play('win');
  scSubmit('sudoku', sd.level, sdScore(), sdShowBest);
}

function sdRender() {
  const grid = document.getElementById('sdGrid');
  if (!grid) return;
  const selVal = sd.sel >= 0 ? sd.grid[sd.sel] : 0;
  const peers = sd.sel >= 0 ? new Set(SD_PEERS[sd.sel]) : new Set();
  let html = '';
  for (let i = 0; i < 81; i++) {
    const v = sd.grid[i], r = sdRow(i), c = sdCol(i);
    let cls = 'sd-cell';
    if (sd.puzzle[i]) cls += ' given';
    if (c % 3 === 2 && c < 8) cls += ' c-r';
    if (r % 3 === 2 && r < 8) cls += ' c-b';
    if (peers.has(i)) cls += ' peer';
    if (selVal && v === selVal) cls += ' same';
    if (i === sd.sel) cls += ' sel';
    if (v && !sd.puzzle[i] && v !== sd.solution[i]) cls += ' bad';      // chiffre faux, signalé tout de suite
    let inner = '';
    if (v) inner = v;
    else if (sd.notes[i]) {
      inner = '<span class="sd-notes">';
      for (let n = 1; n <= 9; n++) inner += '<i>' + (sd.notes[i] & (1 << n) ? n : '') + '</i>';
      inner += '</span>';
    }
    html += '<div class="' + cls + '" role="gridcell" data-i="' + i + '">' + inner + '</div>';
  }
  grid.innerHTML = html;
  // pavé numérique : un chiffre déjà posé 9 fois est grisé
  const counts = Array(10).fill(0);
  sd.grid.forEach(v => { if (v) counts[v]++; });
  document.querySelectorAll('#sdPad [data-n]').forEach(b => b.classList.toggle('done', counts[+b.dataset.n] >= 9));
  document.querySelector('#sdTools [data-a="notes"]').classList.toggle('on', sd.noteMode);
  document.getElementById('sdHints').textContent = sd.hints;
  document.getElementById('sdErrors').textContent = sd.errors + '/' + SD_MAX_ERRORS;
  sdShowTime();
}

function sdKeyHandler(e) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); sdUndo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); sdEnter(+e.key); return; }
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (e.key in moves) {
    e.preventDefault();
    if (sd.sel < 0) { sdSelect(40); return; }
    const r = sdRow(sd.sel), c = sdCol(sd.sel);
    const nr = r + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
    const nc = c + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0);
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) sdSelect(nr * 9 + nc);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); sdErase(); }
  else if (e.key === 'n' || e.key === 'N') sdToggleNotes();
  else if (e.key === 'h' || e.key === 'H') sdHint();
}

GAMES.sudoku = {
  start(saved) { document.addEventListener('keydown', sdKeyHandler); initSudoku(saved); },
  stop() { sdStop(); document.removeEventListener('keydown', sdKeyHandler); },
  inProgress() { return !!sd && sd.started && !sd.won && !sd.lost; },
  save() {
    if (!GAMES.sudoku.inProgress()) return null;
    return { level: sd.level, puzzle: sd.puzzle, solution: sd.solution, grid: sd.grid, notes: sd.notes,
             hints: sd.hints, errors: sd.errors, elapsed: sd.elapsed, started: true, noteMode: sd.noteMode };
  }
};
