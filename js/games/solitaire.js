/* ════════════════════════════════════════════
   SOLITAIRE (Klondike)
════════════════════════════════════════════ */
const SOL_SUITS = ['♠', '♥', '♦', '♣'];
const SOL_RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SOL_UP = 5.4, SOL_DOWN = 2.2;   // décalages en cqw
let sol, solSel = null, solHist = [], solLast = { k: '', t: 0 };
let solElapsed = 0, solClock = null, solFlight = null;

const solRed = c => c.s === 1 || c.s === 2;

// Nouvelle donne : 52 cartes mélangées, 7 colonnes de 1 à 7 cartes (la dernière visible), le reste en pioche
function solDeal(draw) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const game = { stock: [], waste: [], found: [[], [], [], []], tab: [], moves: 0, won: false, draw };
  for (let i = 0; i < 7; i++) {
    const col = deck.splice(0, i + 1);
    col[col.length - 1].up = true;
    game.tab.push(col);
  }
  game.stock = deck;
  return game;
}

function initSolitaire(saved) {
  solStop();
  sol = solDeal(parseInt(document.getElementById('solDraw').value));   // mode de pioche figé pour toute la donne
  solSel = null; solHist = []; solLast = { k: '', t: 0 }; solAuto = false;
  solElapsed = 0;
  if (saved) {   // reprise : donne, annulations possibles et chrono
    sol = solNormalizeFound(saved.sol); solHist = saved.hist || []; solElapsed = saved.elapsed || 0;
    document.getElementById('solDraw').value = sol.draw;
    if (sol.moves > 0) solClockStart();
  }
  solShowTime();
  const b = document.getElementById('solBanner');
  b.className = 'banner'; b.textContent = '';
  const board = document.getElementById('solBoard');
  board.onclick = solClick;
  board.onpointerdown = solPointerDown;
  document.getElementById('solReset').onclick = () => { document.activeElement.blur(); confirmAbandon(() => initSolitaire(), 'Nouvelle donne'); };
  document.getElementById('solDraw').onchange = () => {
    const sel = document.getElementById('solDraw');
    sel.blur(); confirmChange(sel, String(sol.draw), () => initSolitaire(), 'Nouvelle donne');
  };
  document.getElementById('solUndo').onclick = () => { document.activeElement.blur(); solUndo(); };
  solRender();
  if (saved) solMaybeAuto();   // une complétion automatique interrompue reprend
}

// Chrono : démarre au premier coup, s'arrête à la victoire
function solShowTime() {
  const el = document.getElementById('solTime');
  if (el) el.textContent = Math.floor(solElapsed / 60) + ':' + String(solElapsed % 60).padStart(2, '0');
}
function solClockStart() {
  if (solClock || sol.won) return;
  solClock = setInterval(() => { if (!document.hidden) { solElapsed++; solShowTime(); } }, 1000);
}
function solClockStop() { clearInterval(solClock); solClock = null; }

function solPush() {
  if (!sol.counted) { sol.counted = true; Stats.played('solitaire', String(sol.draw)); }
  solClockStart();
  solHist.push(JSON.stringify(sol));
  if (solHist.length > 300) solHist.shift();
}

// Chaque fondation ne contient que sa couleur : remet en ordre les anciennes sauvegardes, où un as pouvait aller sur n'importe quelle pile
function solNormalizeFound(game) {
  const all = game.found.flat();
  game.found = [0, 1, 2, 3].map(s => all.filter(c => c.s === s).sort((a, b) => a.r - b.r));
  return game;
}

function solUndo() {
  if (!solHist.length || solAuto) return;
  sol = solNormalizeFound(JSON.parse(solHist.pop()));
  solSel = null;
  document.getElementById('solBanner').className = 'banner';
  solRender();
}

function solArr(z, i) { return z === 'w' ? sol.waste : z === 't' ? sol.tab[i] : sol.found[i]; }

function solStock() {
  solPush();
  const n = sol.draw;
  Sfx.play('flip');
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
    // chaque fondation est réservée à une couleur : ♠ ♥ ♦ ♣ dans l'ordre des emplacements affichés
    if (card.s !== j) return false;
    const pile = sol.found[j], top = pile[pile.length - 1];
    return top ? card.r === top.r + 1 : card.r === 1;
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
  Sfx.play(to === 'f' ? 'good' : 'place');
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
  if (!dests.length && emptyDest < 0) return false;
  // Plusieurs destinations : on choisit celle qui gêne le moins. Recouvrir une colonne qui cache encore des cartes
  // retarde leur retournement ; on préfère donc la colonne avec le moins de cartes face cachée (puis la plus à gauche).
  // Une colonne vide passe en dernier.
  const hidden = j => sol.tab[j].filter(c => !c.up).length;
  dests.sort((a, b) => hidden(a) - hidden(b) || a - b);
  if (emptyDest >= 0) dests.push(emptyDest);
  solDoMove(sel, 't', dests[0]);
  return true;
}

/* ── complétion automatique ── */
let solAuto = false, solTimer = null;

// fly : mémorise la position de la carte avant son départ pour l'animer vers la fondation
function solAutoStep(fly) {
  const srcs = [['w', 0]].concat(sol.tab.map((_, i) => ['t', i]));
  for (const [z, i] of srcs) {
    if (!solArr(z, i).length) continue;
    const sel = { from: z, i, n: 1 };
    for (let j = 0; j < 4; j++) if (solCanMove(sel, 'f', j)) {
      if (fly && motionOK()) {
        const slot = document.querySelector('.sol-slot[data-zone="' + z + '"][data-i="' + i + '"]');
        const el = slot && slot.lastElementChild;
        if (el) solFlight = { rect: el.getBoundingClientRect(), j };
      }
      solMoveCore(sel, 'f', j);
      return 'found';
    }
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
    const r = !board || sol.won ? false : solAutoStep(true);
    if (r === 'found') { sol.moves++; Sfx.play('good'); if (sol.found.every(p => p.length === 13)) sol.won = true; }
    if (board) { solRender(); solRunFlight(); }
    if (!r || sol.won) { clearInterval(solTimer); solAuto = false; if (board && !sol.won) b.className = 'banner'; }
  }, motionOK() ? 110 : 40);
}

// La carte part de sa position d'origine et glisse jusqu'à la fondation (technique FLIP)
function solRunFlight() {
  const f = solFlight; solFlight = null;
  if (!f) return;
  const slot = document.querySelector('.sol-slot[data-zone="f"][data-i="' + f.j + '"]');
  const el = slot && slot.lastElementChild;
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.zIndex = 30;
  el.animate([{ transform: 'translate(' + (f.rect.left - r.left) + 'px, ' + (f.rect.top - r.top) + 'px)' }, { transform: 'translate(0, 0)' }],
             { duration: 240, easing: 'ease-in' }).onfinish = () => { el.style.zIndex = ''; };
}

// Y a-t-il encore un coup « utile » : carte vers une fondation, carte de la pioche/défausse jouable,
// ou déplacement qui dévoile une carte cachée ou vide une colonne ? (heuristique prudente : toute la pioche est supposée accessible)
function solHasUsefulMove() {
  const canFound = c => sol.found.some(p => { const t = p[p.length - 1]; return t ? t.s === c.s && c.r === t.r + 1 : c.r === 1; });
  const canTab = c => sol.tab.some(col => { const t = col[col.length - 1]; return t ? t.up && solRed(t) !== solRed(c) && t.r === c.r + 1 : c.r === 13; });
  if (sol.stock.concat(sol.waste).some(c => canFound(c) || canTab(c))) return true;
  for (let i = 0; i < 7; i++) {
    const col = sol.tab[i];
    if (!col.length) continue;
    if (col[col.length - 1].up && canFound(col[col.length - 1])) return true;
    for (let idx = 0; idx < col.length; idx++) {
      const card = col[idx];
      if (!card.up) continue;
      const reveals = idx === 0 || !col[idx - 1].up;
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        const dest = sol.tab[j], t = dest[dest.length - 1];
        if (t && t.up && solRed(t) !== solRed(card) && t.r === card.r + 1 && reveals) return true;
        if (!t && card.r === 13 && idx > 0 && !col[idx - 1].up) return true;
      }
    }
  }
  return false;
}

// Arrête tout ce qui tourne en arrière-plan (complétion auto, glisser en cours, chrono)
function solStop() {
  clearInterval(solTimer); solTimer = null; solAuto = false;
  solClockStop();
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
  const n = sol.draw;
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
  solShowTime();
  document.getElementById('solUndo').disabled = !solHist.length;
  const b = document.getElementById('solBanner');
  if (sol.won) {
    solClockStop();
    b.dataset.stuck = '';
    b.className = 'banner win';
    b.textContent = 'Bravo, tu as gagné en ' + sol.moves + ' coups et ' + document.getElementById('solTime').textContent + ' !';
    if (!sol.scored) {
      sol.scored = true;
      Fx.confetti(); Sfx.play('win');
      scSubmit('solitaire', String(sol.draw), sol.moves);
    }
  } else if (!solAuto) {
    if (!solHasUsefulMove()) {
      b.dataset.stuck = '1';
      b.className = 'banner lose';
      b.textContent = 'Plus de coup utile : annule un coup ou lance une nouvelle donne.';
    } else if (b.dataset.stuck) {
      b.dataset.stuck = ''; b.className = 'banner'; b.textContent = '';
    }
  }
}


// Raccourcis : Ctrl+Z annuler, N nouvelle donne
function solKeyHandler(e) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!solAuto) solUndo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); confirmAbandon(() => initSolitaire(), 'Nouvelle donne'); }
}

GAMES.solitaire = {
  wide: true,   // cartes plus grandes sur grand écran
  start(saved) { document.addEventListener('keydown', solKeyHandler); initSolitaire(saved); },
  stop()  { solStop(); document.removeEventListener('keydown', solKeyHandler); },
  inProgress() { return !!sol && sol.moves > 0 && !sol.won; },
  save() {
    if (!GAMES.solitaire.inProgress()) return null;
    return { sol, hist: solHist.slice(-40), elapsed: solElapsed };
  }
};
