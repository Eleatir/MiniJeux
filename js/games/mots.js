/* ════════════════════════════════════════════
   MOTS FLÉCHÉS
   Les définitions sont écrites dans des cases de la grille, avec une flèche vers le début du mot
   (→ le mot commence dans la case à droite, ↓ dans la case en dessous). La première ligne et la première colonne
   ne contiennent que des définitions. Les grilles sont fabriquées à la demande à partir de js/games/mots-words.js.
════════════════════════════════════════════ */
const MF_LEVELS = { small: { rows: 7, cols: 6, density: 0.2 }, medium: { rows: 8, cols: 7, density: 0.24 }, large: { rows: 9, cols: 8, density: 0.26 } };
const MF_MAX_RUN = 5;
const MF_PENALTY = { letter: 15, word: 45, check: 20 };

// Mots classés par longueur : MF_LEX[5] = [{ w: 'TABLE', c: 'Meuble pour manger' }, …]
const MF_LEX = {};
MF_RAW.forEach(line => {
  const i = line.indexOf('|'), w = line.slice(0, i);
  (MF_LEX[w.length] = MF_LEX[w.length] || []).push({ w, c: line.slice(i + 1) });
});

function mfShuffle(a, rnd = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function mfFmt(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* ── forme de la grille : 'L' = case-lettre, 'C' = case-définition ── */

// Suites de cases-lettres d'au moins 2 cases : [{ dir: 'h'|'v', cells: [indices], clueCell }]
// Le début d'un mot est toujours précédé d'une case-définition (la première ligne et la première colonne en sont remplies).
function mfSlots(kind, rows, cols) {
  const slots = [], at = (r, c) => kind[r * cols + c];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (at(r, c) !== 'L') continue;
    if (c > 0 && at(r, c - 1) === 'C' && c + 1 < cols && at(r, c + 1) === 'L') {
      const cells = [];
      for (let k = c; k < cols && at(r, k) === 'L'; k++) cells.push(r * cols + k);
      slots.push({ dir: 'h', cells, clueCell: r * cols + c - 1 });
    }
    if (r > 0 && at(r - 1, c) === 'C' && r + 1 < rows && at(r + 1, c) === 'L') {
      const cells = [];
      for (let k = r; k < rows && at(k, c) === 'L'; k++) cells.push(k * cols + c);
      slots.push({ dir: 'v', cells, clueCell: (r - 1) * cols + c });
    }
  }
  return slots;
}

// Toute case-lettre doit appartenir à un mot (au moins 2 lettres dans un sens)
function mfAllInWords(kind, rows, cols) {
  const inWord = Array(rows * cols).fill(false);
  mfSlots(kind, rows, cols).forEach(s => s.cells.forEach(i => { inWord[i] = true; }));
  return kind.every((k, i) => k !== 'L' || inWord[i]);
}

// Dessine la forme d'une grille au hasard (null si l'essai échoue : on recommence)
function mfLayout(level, rnd = Math.random) {
  const { rows, cols, density } = MF_LEVELS[level];
  const kind = Array(rows * cols).fill('L');
  for (let c = 0; c < cols; c++) kind[c] = 'C';
  for (let r = 0; r < rows; r++) kind[r * cols] = 'C';
  const interior = [];
  for (let r = 1; r < rows; r++) for (let c = 1; c < cols; c++) interior.push(r * cols + c);
  const isInterior = j => j >= cols && j % cols !== 0;
  const touchesClue = i => [i - 1, i + 1, i - cols, i + cols].some(j => j >= 0 && j < kind.length && isInterior(j) && kind[j] === 'C');
  // 1. quelques cases-définitions au hasard, sans qu'elles se touchent, tant que chaque lettre reste dans un mot
  let placed = 0;
  const target = Math.round(interior.length * density);
  for (const i of mfShuffle(interior, rnd)) {
    if (placed >= target) break;
    if (touchesClue(i)) continue;
    kind[i] = 'C';
    if (mfAllInWords(kind, rows, cols)) placed++; else kind[i] = 'L';
  }
  // 2. on coupe les mots trop longs ; 3. une case-définition sans mot à indiquer est remise en lettre (et ne sera plus rejouée)
  const banned = new Set();
  for (let round = 0; round < 30; round++) {
    const long = mfSlots(kind, rows, cols).find(s => s.cells.length > MF_MAX_RUN);
    if (long) {
      let cut = false;
      for (const i of mfShuffle(long.cells.slice(1, -1), rnd)) {
        if (banned.has(i) || touchesClue(i)) continue;
        kind[i] = 'C';
        if (mfAllInWords(kind, rows, cols)) { cut = true; break; }
        kind[i] = 'L';
      }
      if (!cut) return null;
      continue;
    }
    const used = new Set(mfSlots(kind, rows, cols).map(s => s.clueCell));
    const dead = interior.find(i => kind[i] === 'C' && !used.has(i));
    if (dead === undefined) {
      const slots = mfSlots(kind, rows, cols);
      return slots.filter(s => s.cells.length === 2).length > Math.ceil(slots.length * 0.2) ? null : { kind, slots };   // peu de mots de 2 lettres : ils sont trop ambigus
    }
    kind[dead] = 'L'; banned.add(dead);
  }
  return null;
}

/* ── remplissage avec des mots du lexique (recherche avec retour arrière) ── */

function mfFill(kind, slots, rnd = Math.random, budget = 800) {
  const letters = Array(kind.length).fill('');
  const chosen = Array(slots.length).fill(null);
  const used = new Set();
  let nodes = 0;
  const candidates = s => {
    const pat = s.cells.map(i => letters[i]);
    return (MF_LEX[s.cells.length] || []).filter(e => {
      if (used.has(e.w)) return false;
      for (let k = 0; k < pat.length; k++) if (pat[k] && pat[k] !== e.w[k]) return false;
      return true;
    });
  };
  const solve = () => {
    if (++nodes > budget) return false;
    let best = -1, bestList = null;
    for (let si = 0; si < slots.length; si++) {
      if (chosen[si]) continue;
      const list = candidates(slots[si]);
      if (!list.length) return false;
      if (!bestList || list.length < bestList.length) { best = si; bestList = list; if (list.length === 1) break; }
    }
    if (best < 0) return true;
    const s = slots[best];
    for (const e of mfShuffle(bestList, rnd).slice(0, 14)) {
      const before = s.cells.map(i => letters[i]);
      s.cells.forEach((i, k) => { letters[i] = e.w[k]; });
      chosen[best] = e; used.add(e.w);
      if (solve()) return true;
      s.cells.forEach((i, k) => { letters[i] = before[k]; });
      chosen[best] = null; used.delete(e.w);
      if (nodes > budget) return false;
    }
    return false;
  };
  return solve() ? { letters, chosen } : null;
}

// Une grille complète : { rows, cols, kind, sol, slots: [{ dir, cells, clueCell, text }] }
function mfGenerate(level, rnd = Math.random) {
  const { rows, cols } = MF_LEVELS[level];
  for (let attempt = 0; attempt < 1500; attempt++) {
    const lay = mfLayout(level, rnd);
    if (!lay) continue;
    const filled = mfFill(lay.kind, lay.slots, rnd);
    if (!filled) continue;
    const sol = lay.kind.map((k, i) => (k === 'L' ? filled.letters[i] : ''));
    return { rows, cols, kind: lay.kind, sol, slots: lay.slots.map((s, i) => ({ dir: s.dir, cells: s.cells, clueCell: s.clueCell, text: filled.chosen[i].c })) };
  }
  return null;
}

/* ── partie ── */

let mf = null, mfClock = null;

function mfIndex() {      // pour chaque case-lettre, le mot horizontal et le mot vertical qui la contiennent
  mf.at = mf.kind.map(() => ({ h: -1, v: -1 }));
  mf.slots.forEach((s, si) => s.cells.forEach(i => { mf.at[i][s.dir] = si; }));
  mf.firstLetter = mf.kind.findIndex(k => k === 'L');
}

function mfNewState(level) {
  const p = mfGenerate(level);
  const state = Object.assign({ level, grid: p.kind.map(() => ''), rev: p.kind.map(() => 0), hints: 0, pen: 0, elapsed: 0, started: false }, p);
  return state;
}

function mfRestore(level, saved) {
  mf = Object.assign({ level }, saved, { wrong: {}, sel: -1, dir: 'h', won: false });
  if (!mf.wrong) mf.wrong = {};
  mfIndex();
}

function initMots(saved) {
  mfStop();
  const sel = document.getElementById('mfLevel');
  if (saved && MF_LEVELS[saved.level]) sel.value = saved.level;
  const level = sel.value;
  if (saved && MF_LEVELS[saved.level]) mfRestore(level, saved);
  else { mf = Object.assign(mfNewState(level), { wrong: {}, sel: -1, dir: 'h', won: false }); mfIndex(); }
  if (!mf.won && mf.sel < 0 && mf.slots.length) { mf.dir = mf.slots[0].dir; mf.sel = mf.slots[0].cells[0]; }
  const banner = document.getElementById('mfBanner');
  banner.className = 'banner'; banner.textContent = '';
  document.getElementById('mfReset').onclick = () => { document.activeElement.blur(); confirmAbandon(() => initMots(), 'Nouvelle grille'); };
  sel.onchange = () => { sel.blur(); confirmChange(sel, mf.level, () => initMots(), 'Nouvelle grille'); };
  const grid = document.getElementById('mfGrid');
  grid.onclick = e => {
    const q = e.target.closest('[data-slot]');
    if (q) { mfPickSlot(+q.dataset.slot); return; }
    const c = e.target.closest('.mf-cell');
    if (c) mfSelect(+c.dataset.i);
  };
  document.getElementById('mfKeys').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    if (b.dataset.k === 'back') mfBackspace(); else mfType(b.dataset.k);
  };
  document.getElementById('mfClue').onclick = mfTurn;
  document.getElementById('mfTools').onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    ({ check: mfCheck, letter: mfHintLetter, word: mfHintWord, turn: mfTurn })[b.dataset.a]();
  };
  if (mf.started && !mf.won) mfClockStart();
  mfShowBest();
  mfRender();
}

function mfShowBest() {
  const el = document.getElementById('mfBest');
  if (!el) return;
  const best = scBest('mots', mf.level);
  el.textContent = best === null ? '—' : mfFmt(best);
}

function mfClockStart() {
  if (mfClock || mf.won) return;
  mfClock = setInterval(() => { if (!document.hidden && !mf.won) { mf.elapsed++; mfShowTime(); } }, 1000);
}
function mfClockStop() { clearInterval(mfClock); mfClock = null; }
function mfStop() { mfClockStop(); }
function mfShowTime() {
  const el = document.getElementById('mfTime');
  if (el) el.textContent = mfFmt(mf.elapsed);
}
function mfScore() { return mf.elapsed + mf.pen; }

function mfStarted() {
  if (!mf.started) { mf.started = true; Stats.played('mots', mf.level); }
  mfClockStart();
}

// Mot actif : celui de la case choisie dans le sens courant (sinon dans l'autre sens)
function mfActive() {
  if (mf.sel < 0) return -1;
  const a = mf.at[mf.sel];
  return a[mf.dir] >= 0 ? a[mf.dir] : (a.h >= 0 ? a.h : a.v);
}

function mfSelect(i) {
  if (mf.kind[i] !== 'L') return;
  if (i === mf.sel) mfTurn();
  else {
    mf.sel = i;
    if (mf.at[i][mf.dir] < 0) mf.dir = mf.dir === 'h' ? 'v' : 'h';
  }
  mfRender();
}

function mfTurn() {
  if (mf.sel < 0) return;
  const other = mf.dir === 'h' ? 'v' : 'h';
  if (mf.at[mf.sel][other] >= 0) mf.dir = other;
  mfRender();
}

// Toucher une définition : on se place sur la première lettre de son mot
function mfPickSlot(si) {
  const s = mf.slots[si];
  mf.dir = s.dir;
  const first = s.cells.find(i => !mf.grid[i]) ;
  mf.sel = first === undefined ? s.cells[0] : first;
  mfRender();
}

const mfLocked = () => mf.won;

function mfType(ch) {
  if (mfLocked() || mf.sel < 0 || mf.rev[mf.sel]) return;
  ch = String(ch).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (!/^[A-Z]$/.test(ch)) return;
  mfStarted();
  mf.grid[mf.sel] = ch;
  delete mf.wrong[mf.sel];
  Sfx.play('tick');
  const si = mfActive();
  if (si >= 0) {
    const cells = mf.slots[si].cells, k = cells.indexOf(mf.sel);
    if (k >= 0 && k + 1 < cells.length) mf.sel = cells[k + 1];
  }
  mfAfterChange();
}

function mfBackspace() {
  if (mfLocked() || mf.sel < 0) return;
  if (mf.grid[mf.sel] && !mf.rev[mf.sel]) { mf.grid[mf.sel] = ''; delete mf.wrong[mf.sel]; mfRender(); return; }
  const si = mfActive();
  if (si >= 0) {
    const cells = mf.slots[si].cells, k = cells.indexOf(mf.sel);
    if (k > 0) {
      mf.sel = cells[k - 1];
      if (!mf.rev[mf.sel]) { mf.grid[mf.sel] = ''; delete mf.wrong[mf.sel]; }
    }
  }
  mfRender();
}

// Déplacement aux flèches : prochaine case-lettre dans la direction demandée
function mfMove(dr, dc) {
  if (mf.sel < 0) { mf.sel = mf.firstLetter; mfRender(); return; }
  const cols = mf.cols, rows = mf.rows;
  let r = Math.floor(mf.sel / cols) + dr, c = (mf.sel % cols) + dc;
  while (r >= 0 && r < rows && c >= 0 && c < cols) {
    const i = r * cols + c;
    if (mf.kind[i] === 'L') {
      mf.sel = i;
      const want = dr ? 'v' : 'h';
      if (mf.at[i][want] >= 0) mf.dir = want; else if (mf.at[i][mf.dir] < 0) mf.dir = want === 'h' ? 'v' : 'h';
      mfRender();
      return;
    }
    r += dr; c += dc;
  }
}

function mfSolved() { return mf.kind.every((k, i) => k !== 'L' || mf.grid[i] === mf.sol[i]); }

function mfAfterChange() {
  if (mfSolved()) { mfWin(); }
  mfRender();
}

function mfPenalty(kind) { mf.pen += MF_PENALTY[kind]; mf.hints++; }

function mfReveal(i) { mf.grid[i] = mf.sol[i]; mf.rev[i] = 1; delete mf.wrong[i]; }

// Indice « lettre » : la case choisie (ou la première case vide ou fausse du mot actif)
function mfHintLetter() {
  if (mfLocked() || mf.sel < 0) return;
  let i = mf.sel;
  if (mf.grid[i] === mf.sol[i]) {
    const si = mfActive();
    i = si < 0 ? -1 : mf.slots[si].cells.find(c => mf.grid[c] !== mf.sol[c]);
    if (i === undefined || i < 0) return;
  }
  mfStarted(); mfPenalty('letter'); mfReveal(i); mf.sel = i;
  Sfx.play('good');
  mfAfterChange();
}

function mfHintWord() {
  if (mfLocked()) return;
  const si = mfActive();
  if (si < 0) return;
  const cells = mf.slots[si].cells.filter(c => mf.grid[c] !== mf.sol[c]);
  if (!cells.length) return;
  mfStarted(); mfPenalty('word');
  cells.forEach(mfReveal);
  Sfx.play('good');
  mfAfterChange();
}

// Vérifier : les lettres fausses sont marquées en rouge (elles le restent jusqu'à ce qu'on les corrige)
function mfCheck() {
  if (mfLocked()) return;
  const bad = mf.kind.map((k, i) => i).filter(i => mf.kind[i] === 'L' && mf.grid[i] && mf.grid[i] !== mf.sol[i]);
  mfStarted(); mfPenalty('check');
  mf.wrong = {};
  bad.forEach(i => { mf.wrong[i] = 1; });
  scToast(bad.length ? bad.length + (bad.length > 1 ? ' lettres fausses' : ' lettre fausse') : 'Aucune erreur pour le moment');
  Sfx.play(bad.length ? 'bad' : 'good');
  mfRender();
}

function mfWin() {
  mf.won = true; mf.sel = -1; mf.wrong = {};
  mfClockStop();
  const b = document.getElementById('mfBanner');
  b.className = 'banner win';
  b.textContent = 'Bravo, grille terminée en ' + mfFmt(mf.elapsed) + (mf.pen ? ' + ' + mf.pen + ' s d\'aides = ' + mfFmt(mfScore()) : '') + ' !';
  Fx.confetti(); Sfx.play('win');
  scSubmit('mots', mf.level, mfScore(), mfShowBest);
}

function mfRender() {
  const grid = document.getElementById('mfGrid');
  if (!grid) return;
  const wrap = grid.parentNode;
  wrap.style.setProperty('--cols', mf.cols); wrap.style.setProperty('--rows', mf.rows);
  const act = mfActive(), inWord = new Set(act >= 0 ? mf.slots[act].cells : []);
  // définitions par case
  const clues = {};
  mf.slots.forEach((s, si) => { (clues[s.clueCell] = clues[s.clueCell] || []).push(si); });
  let html = '';
  for (let i = 0; i < mf.kind.length; i++) {
    if (mf.kind[i] === 'C') {
      const list = clues[i] || [];
      html += '<div class="mf-clue' + (list.length === 2 ? ' two' : list.length ? ' one' : ' empty') + '">' +
        list.map(si => '<span class="mf-q' + (si === act ? ' act' : '') + '" data-slot="' + si + '"><b>' + mfEsc(mf.slots[si].text) + '</b><i>' + (mf.slots[si].dir === 'h' ? '→' : '↓') + '</i></span>').join('') + '</div>';
      continue;
    }
    let cls = 'mf-cell';
    if (inWord.has(i)) cls += ' word';
    if (i === mf.sel) cls += ' sel';
    if (mf.rev[i]) cls += ' rev';
    if (mf.wrong[i]) cls += ' bad';
    html += '<div class="' + cls + '" role="gridcell" data-i="' + i + '">' + (mf.grid[i] || '') + '</div>';
  }
  grid.innerHTML = html;
  const bar = document.getElementById('mfClue');
  if (bar) {
    const s = act >= 0 ? mf.slots[act] : null;
    bar.textContent = s ? (s.dir === 'h' ? '→ ' : '↓ ') + s.text + ' (' + s.cells.length + ')' : 'Touche une case ou une définition';
  }
  document.getElementById('mfHints').textContent = mf.hints;
  mfShowTime();
}

function mfEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

function mfKeyHandler(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (e.key in moves) { e.preventDefault(); mfMove(...moves[e.key]); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); mfBackspace(); return; }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); mfTurn(); return; }
  if (e.key.length === 1) { e.preventDefault(); mfType(e.key); }
}

GAMES.mots = {
  start(saved) { document.addEventListener('keydown', mfKeyHandler); initMots(saved); },
  stop() { mfStop(); document.removeEventListener('keydown', mfKeyHandler); },
  inProgress() { return !!mf && mf.started && !mf.won; },
  canPause() { return !!mf && !mf.won; },
  pause() { mfClockStop(); },
  resume() { if (mf.started) mfClockStart(); },
  save() {
    if (!GAMES.mots.inProgress()) return null;
    return { level: mf.level, rows: mf.rows, cols: mf.cols, kind: mf.kind, sol: mf.sol, slots: mf.slots, grid: mf.grid, rev: mf.rev,
             hints: mf.hints, pen: mf.pen, elapsed: mf.elapsed, started: true };
  }
};
