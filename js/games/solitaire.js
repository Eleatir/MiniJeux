/* ════════════════════════════════════════════
   SOLITAIRE (Klondike)
════════════════════════════════════════════ */
const SOL_SUITS = ['♠', '♥', '♦', '♣'];
const SOL_RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SOL_UP = 5.4, SOL_DOWN = 2.2;   // décalages en cqw
let sol, solSel = null, solHist = [], solLast = { k: '', t: 0 };

const solRed = c => c.s === 1 || c.s === 2;

function initSolitaire() {
  solStop();
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  sol = { stock: [], waste: [], found: [[], [], [], []], tab: [], moves: 0, won: false };
  for (let i = 0; i < 7; i++) {
    const col = deck.splice(0, i + 1);
    col[col.length - 1].up = true;
    sol.tab.push(col);
  }
  sol.stock = deck;
  solSel = null; solHist = []; solLast = { k: '', t: 0 }; solAuto = false;
  const b = document.getElementById('solBanner');
  b.className = 'banner'; b.textContent = '';
  const board = document.getElementById('solBoard');
  board.onclick = solClick;
  board.onpointerdown = solPointerDown;
  document.getElementById('solReset').onclick = () => { document.activeElement.blur(); initSolitaire(); };
  document.getElementById('solDraw').onchange = () => { document.activeElement.blur(); initSolitaire(); };
  document.getElementById('solUndo').onclick = () => { document.activeElement.blur(); solUndo(); };
  solRender();
}

function solPush() {
  solHist.push(JSON.stringify(sol));
  if (solHist.length > 300) solHist.shift();
}

function solUndo() {
  if (!solHist.length || solAuto) return;
  sol = JSON.parse(solHist.pop());
  solSel = null;
  document.getElementById('solBanner').className = 'banner';
  solRender();
}

function solArr(z, i) { return z === 'w' ? sol.waste : z === 't' ? sol.tab[i] : sol.found[i]; }

function solStock() {
  solPush();
  const n = parseInt(document.getElementById('solDraw').value);
  if (sol.stock.length) {
    for (let k = 0; k < n && sol.stock.length; k++) {
      const c = sol.stock.pop(); c.up = true; sol.waste.push(c);
    }
  } else if (sol.waste.length) {
    sol.stock = sol.waste.reverse(); sol.waste = [];
    sol.stock.forEach(c => c.up = false);
  } else { solHist.pop(); return; }
  sol.moves++;
}

function solCanMove(sel, to, j) {
  const src = solArr(sel.from, sel.i);
  const card = src[src.length - sel.n];
  if (to === 'f') {
    if (sel.n !== 1) return false;
    const pile = sol.found[j], top = pile[pile.length - 1];
    return top ? top.s === card.s && card.r === top.r + 1 : card.r === 1;
  }
  if (to === 't') {
    if (sel.from === 't' && sel.i === j) return false;
    const pile = sol.tab[j], top = pile[pile.length - 1];
    if (!top) return card.r === 13;
    return top.up && solRed(top) !== solRed(card) && top.r === card.r + 1;
  }
  return false;
}

function solDoMove(sel, to, j) {
  solPush();
  solMoveCore(sel, to, j);
}

function solMoveCore(sel, to, j) {
  const src = solArr(sel.from, sel.i);
  const moving = src.splice(src.length - sel.n, sel.n);
  (to === 'f' ? sol.found[j] : sol.tab[j]).push(...moving);
  if (sel.from === 't' && src.length && !src[src.length - 1].up) src[src.length - 1].up = true;
  sol.moves++;
  if (sol.found.every(p => p.length === 13)) sol.won = true;
}

function solAutoMove(z, i, idx) {
  const src = solArr(z, i);
  let sel;
  if (z === 'w') { if (!src.length) return false; sel = { from: 'w', i: 0, n: 1 }; }
  else if (z === 't') { if (idx < 0 || !src[idx] || !src[idx].up) return false; sel = { from: 't', i, n: src.length - idx }; }
  else return false;
  // 1) fondations
  if (sel.n === 1) {
    for (let j = 0; j < 4; j++) if (solCanMove(sel, 'f', j)) { solDoMove(sel, 'f', j); return true; }
  }
  // 2) unique destination possible dans le tableau (les colonnes vides comptent pour une seule)
  const dests = []; let emptyDest = -1;
  for (let j = 0; j < 7; j++) {
    if (!solCanMove(sel, 't', j)) continue;
    if (!sol.tab[j].length) {
      if (z === 't' && idx === 0) continue;   // roi déjà au fond d'une colonne : inutile
      if (emptyDest < 0) emptyDest = j;
    } else dests.push(j);
  }
  if (emptyDest >= 0) dests.push(emptyDest);
  if (dests.length === 1) { solDoMove(sel, 't', dests[0]); return true; }
  if (dests.length > 1) solSel = sel;        // ambigu : la carte reste sélectionnée
  return false;
}

/* ── complétion automatique ── */
let solAuto = false, solTimer = null;

function solAutoStep() {
  const srcs = [['w', 0]].concat(sol.tab.map((_, i) => ['t', i]));
  for (const [z, i] of srcs) {
    if (!solArr(z, i).length) continue;
    const sel = { from: z, i, n: 1 };
    for (let j = 0; j < 4; j++) if (solCanMove(sel, 'f', j)) { solMoveCore(sel, 'f', j); return 'found'; }
  }
  if (sol.stock.length) { const c = sol.stock.pop(); c.up = true; sol.waste.push(c); return 'draw'; }
  if (sol.waste.length) { sol.stock = sol.waste.reverse(); sol.waste = []; sol.stock.forEach(c => c.up = false); return 'draw'; }
  return false;
}

// Joue les coups vers les fondations (en piochant carte par carte) ; renvoie true si la donne se termine.
function solAutoRun(onStep) {
  let idle = 0;
  while (!sol.won) {
    const r = solAutoStep();
    if (!r) return false;
    idle = r === 'draw' ? idle + 1 : 0;
    if (idle > sol.stock.length + sol.waste.length + 2) return false;
    if (onStep) onStep();
  }
  return true;
}

function solMaybeAuto() {
  if (sol.won || solAuto) return;
  if (!sol.tab.every(col => col.every(c => c.up))) return;
  const snap = JSON.stringify(sol);
  const ok = solAutoRun();                   // simulation : la donne est-elle gagnable sans autre coup ?
  sol = JSON.parse(snap);
  if (!ok) return;
  solPush();
  solAuto = true; solSel = null;
  const b = document.getElementById('solBanner');
  b.className = 'banner win'; b.textContent = 'Complétion automatique…';
  solTimer = setInterval(() => {
    const board = document.getElementById('solBoard');
    const r = !board || sol.won ? false : solAutoStep();
    if (r === 'found') { sol.moves++; if (sol.found.every(p => p.length === 13)) sol.won = true; }
    if (board) solRender();
    if (!r || sol.won) { clearInterval(solTimer); solAuto = false; if (board && !sol.won) b.className = 'banner'; }
  }, 70);
}

// Arrête tout ce qui tourne en arrière-plan (complétion auto, glisser en cours)
function solStop() {
  clearInterval(solTimer); solTimer = null; solAuto = false;
  document.removeEventListener('pointermove', solPointerMove);
  document.removeEventListener('pointerup', solPointerUp);
  document.removeEventListener('pointercancel', solPointerUp);
  solDrag = null;
}

function solUpdate() { solRender(); solMaybeAuto(); }

let solDrag = null, solNoClick = false;

function solPointerDown(e) {
  if (e.button !== 0 || sol.won || solDrag || solAuto) return;
  const el = e.target.closest('.sol-card[data-zone]');
  if (!el) return;
  const z = el.dataset.zone, i = +el.dataset.i;
  const idx = el.dataset.idx === undefined ? -1 : +el.dataset.idx;
  if (z === 's') return;
  const arr = solArr(z, i);
  let sel = null;
  if (z === 'w' && arr.length) sel = { from: 'w', i: 0, n: 1 };
  else if (z === 'f' && arr.length) sel = { from: 'f', i, n: 1 };
  else if (z === 't' && idx >= 0 && arr[idx].up) sel = { from: 't', i, n: arr.length - idx };
  if (!sel) return;
  const els = z === 't'
    ? [...document.querySelectorAll('.sol-card[data-zone="t"][data-i="' + i + '"]')].filter(c => +c.dataset.idx >= idx)
    : [el];
  solDrag = { sel, els, x0: e.clientX, y0: e.clientY, active: false, ghost: null, ox: 0, oy: 0 };
  document.addEventListener('pointermove', solPointerMove);
  document.addEventListener('pointerup', solPointerUp);
  document.addEventListener('pointercancel', solPointerUp);
}

function solDragStart() {
  const d = solDrag, board = document.getElementById('solBoard');
  const br = board.getBoundingClientRect(), fr = d.els[0].getBoundingClientRect();
  d.ox = d.x0 - fr.left; d.oy = d.y0 - fr.top; d.br = br;
  const ghost = document.createElement('div');
  ghost.className = 'sol-ghost';
  ghost.style.width = fr.width + 'px';
  d.els.forEach(el => {
    const r = el.getBoundingClientRect(), c = el.cloneNode(true);
    c.classList.remove('sel');
    c.style.left = '0'; c.style.top = (r.top - fr.top) + 'px';
    c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
    c.style.fontSize = getComputedStyle(el).fontSize;
    ghost.appendChild(c);
    el.style.opacity = '0.25';
  });
  board.appendChild(ghost);
  d.ghost = ghost; d.active = true;
  solSel = null;
  document.querySelectorAll('.sol-slot[data-zone="t"], .sol-slot[data-zone="f"]').forEach(sl => {
    if (solCanMove(d.sel, sl.dataset.zone, +sl.dataset.i)) sl.classList.add('drop');
  });
}

function solPointerMove(e) {
  const d = solDrag;
  if (!d) return;
  if (!d.active) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    solDragStart();
  }
  e.preventDefault();
  d.ghost.style.left = (e.clientX - d.ox - d.br.left) + 'px';
  d.ghost.style.top  = (e.clientY - d.oy - d.br.top) + 'px';
}

function solPointerUp(e) {
  const d = solDrag;
  document.removeEventListener('pointermove', solPointerMove);
  document.removeEventListener('pointerup', solPointerUp);
  document.removeEventListener('pointercancel', solPointerUp);
  solDrag = null;
  if (!d || !d.active) return;
  solNoClick = true; setTimeout(() => { solNoClick = false; }, 100);
  let moved = false;
  if (e.type === 'pointerup') {
    // cible : sous le pointeur, sinon sous le centre de la carte tirée
    const gr = d.ghost.firstChild.getBoundingClientRect();
    const pts = [[e.clientX, e.clientY], [gr.left + gr.width / 2, gr.top + gr.height / 2]];
    for (const [x, y] of pts) {
      const t = document.elementFromPoint(x, y), tz = t && t.closest('[data-zone]');
      if (!tz) continue;
      const z = tz.dataset.zone, i = +tz.dataset.i;
      if ((z === 't' || z === 'f') && solCanMove(d.sel, z, i)) { solDoMove(d.sel, z, i); moved = true; break; }
    }
  }
  d.ghost.remove();
  solSel = null;
  solUpdate();
}

function solClick(e) {
  if (solNoClick || solAuto) return;
  const el = e.target.closest('[data-zone]');
  if (!el || sol.won) return;
  const z = el.dataset.zone, i = +el.dataset.i;
  const idx = el.dataset.idx === undefined ? -1 : +el.dataset.idx;
  if (z === 's') { solSel = null; solStock(); solUpdate(); return; }

  // double clic / double tap : vers les fondations
  const key = z + i + '_' + idx, now = Date.now();
  const dbl = (idx >= 0 || z === 'w') && solLast.k === key && now - solLast.t < 350;
  solLast = { k: key, t: now };
  if (dbl) { solSel = null; solAutoMove(z, i, idx); solUpdate(); return; }

  if (solSel) {
    const s = solSel; solSel = null;
    const src = solArr(s.from, s.i);
    if (s.from === z && s.i === i && (z !== 't' || idx === src.length - s.n)) { solRender(); return; }  // même carte : désélection
    if ((z === 't' || z === 'f') && solCanMove(s, z, i)) { solDoMove(s, z, i); solUpdate(); return; }
  }

  // sélection
  const arr = solArr(z, i);
  if (z === 'w' && arr.length) solSel = { from: 'w', i: 0, n: 1 };
  else if (z === 'f' && arr.length) solSel = { from: 'f', i, n: 1 };
  else if (z === 't' && idx >= 0) {
    if (arr[idx].up) solSel = { from: 't', i, n: arr.length - idx };
    else if (idx === arr.length - 1) { solPush(); arr[idx].up = true; sol.moves++; }
  }
  solUpdate();
}

function solCardEl(c, z, i, idx, top, sel) {
  const d = document.createElement('div');
  d.className = 'sol-card' + (c.up ? (solRed(c) ? ' red' : '') : ' back') + (sel ? ' sel' : '');
  d.dataset.zone = z; d.dataset.i = i; if (idx >= 0) d.dataset.idx = idx;
  d.style.top = top + 'cqw';
  if (c.up) {
    d.innerHTML = '<span class="sol-corner">' + SOL_RANKS[c.r] + '<br>' + SOL_SUITS[c.s] + '</span>' +
                  '<span class="sol-big">' + SOL_SUITS[c.s] + '</span>';
  }
  return d;
}

function solSlot(z, i, label) {
  const d = document.createElement('div');
  d.className = 'sol-slot'; d.dataset.zone = z; d.dataset.i = i;
  if (label) d.textContent = label;
  return d;
}

function solRender() {
  const board = document.getElementById('solBoard');
  board.innerHTML = '';
  const top = document.createElement('div'); top.className = 'sol-top';

  // pioche
  const stock = solSlot('s', 0, sol.stock.length ? '' : '↻');
  if (sol.stock.length) stock.appendChild(solCardEl({ up: false, s: 0, r: 1 }, 's', 0, -1, 0, false));
  top.appendChild(stock);

  // défausse (jusqu'à 3 cartes visibles en éventail)
  const waste = solSlot('w', 0);
  const n = parseInt(document.getElementById('solDraw').value);
  const shown = sol.waste.slice(-(n === 3 ? 3 : 1));
  shown.forEach((c, k) => {
    const isTop = k === shown.length - 1;
    const el = solCardEl(c, 'w', 0, -1, 0, isTop && solSel && solSel.from === 'w');
    el.style.left = (k * 4) + 'cqw'; el.style.width = '100%';
    if (!isTop) el.style.pointerEvents = 'none';
    waste.appendChild(el);
  });
  top.appendChild(waste);
  top.appendChild(document.createElement('div'));

  // fondations
  sol.found.forEach((pile, j) => {
    const slot = solSlot('f', j, pile.length ? '' : SOL_SUITS[j]);
    if (pile.length) {
      slot.appendChild(solCardEl(pile[pile.length - 1], 'f', j, -1, 0, solSel && solSel.from === 'f' && solSel.i === j));
    }
    top.appendChild(slot);
  });
  board.appendChild(top);

  // colonnes
  const tab = document.createElement('div'); tab.className = 'sol-tab';
  let maxOff = 0;
  sol.tab.forEach((col, i) => {
    const slot = solSlot('t', i);
    let off = 0;
    col.forEach((c, k) => {
      const selected = solSel && solSel.from === 't' && solSel.i === i && k >= col.length - solSel.n;
      slot.appendChild(solCardEl(c, 't', i, k, off, selected));
      off += c.up ? SOL_UP : SOL_DOWN;
    });
    maxOff = Math.max(maxOff, off - (col.length && col[col.length - 1].up ? SOL_UP : SOL_DOWN));
    tab.appendChild(slot);
  });
  tab.style.paddingBottom = (maxOff + 2) + 'cqw';
  board.appendChild(tab);

  document.getElementById('solMoves').textContent = sol.moves;
  document.getElementById('solUndo').disabled = !solHist.length;
  if (sol.won) {
    const b = document.getElementById('solBanner');
    b.className = 'banner win';
    b.textContent = 'Bravo, tu as gagné en ' + sol.moves + ' coups !';
    if (!sol.scored) {
      sol.scored = true;
      scSubmit('solitaire', document.getElementById('solDraw').value, sol.moves);
    }
  }
}


GAMES.solitaire = {
  start() { initSolitaire(); },
  stop()  { solStop(); }
};
