/* ════════════════════════════════════════════
   SCORES  (tableaux locaux, saisie du nom façon borne d'arcade)
════════════════════════════════════════════ */
const SC_KEY = 'minijeux.scores.v1', SC_NAME_KEY = 'minijeux.name', SC_MAX = 10;
const SC_ORDER = ['wordle', 'minesweeper', 'snake', '2048', 'solitaire'];
const SC_GAMES = {
  wordle:      { icon:'🟩', label:'Wordle',   dir:'asc',  modes:{ 5:'5 lettres', 6:'6 lettres', 7:'7 lettres' },
                 fmt: v => Math.floor(v / 1000) + (v < 2000 ? ' essai' : ' essais') + ' · ' + (v % 1000) + ' s' },
  minesweeper: { icon:'💣', label:'Démineur', dir:'asc',  modes:{ easy:'Facile', medium:'Moyen', hard:'Difficile' },
                 fmt: v => (v / 100).toFixed(2) + ' s' },
  snake:       { icon:'🐍', label:'Snake',    dir:'desc', modes:{ slow:'Facile', medium:'Moyen', fast:'Difficile' },
                 fmt: v => v + ' pts' },
  '2048':      { icon:'🧩', label:'2048',     dir:'desc', modes:{ all:'Classique' },
                 fmt: v => v + ' pts' },
  solitaire:   { icon:'🃏', label:'Solitaire', dir:'asc', modes:{ 1:'Pioche 1', 3:'Pioche 3' },
                 fmt: v => v + ' coups' }
};
let scData = null, scUI = null;

function scLoad() {
  if (scData) return scData;
  scData = {};
  try { scData = JSON.parse(localStorage.getItem(SC_KEY)) || {}; } catch (e) {}
  return scData;
}
function scSave() { try { localStorage.setItem(SC_KEY, JSON.stringify(scData)); } catch (e) {} }

// Normalise une entrée lue du stockage ou d'un fichier importé (jamais de HTML dans le nom)
function scClean(e) {
  const n = String((e && e.n) || '').replace(/[^A-Z]/g, '').slice(0, 3) || '???';
  const d = Number(e && e.d) || 0;
  return { n, v: Number(e && e.v) || 0, d, id: d + '-' + n };
}

function scList(g, m) {
  const raw = (scLoad()[g] || {})[m];
  if (!Array.isArray(raw)) return [];
  return raw.map(scClean).slice(0, SC_MAX);
}

// Export / import des scores (fichier JSON), pour les garder ou les déplacer vers un autre navigateur
function scExport() {
  const blob = new Blob([JSON.stringify({ app: 'minijeux', version: 1, scores: scLoad() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'minijeux-scores.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Fusionne les scores d'un fichier dans les tableaux actuels ; renvoie le nombre de scores ajoutés
function scImportData(d) {
  if (!d || d.app !== 'minijeux' || typeof d.scores !== 'object' || !d.scores) throw new Error('format');
  let added = 0;
  SC_ORDER.forEach(g => Object.keys(SC_GAMES[g].modes).forEach(m => {
    const incoming = (d.scores[g] || {})[m];
    if (!Array.isArray(incoming)) return;
    const list = scList(g, m), ids = new Set(list.map(e => e.id));
    incoming.map(scClean).forEach(e => { if (!ids.has(e.id)) { ids.add(e.id); list.push(e); added++; } });
    const asc = SC_GAMES[g].dir === 'asc';
    list.sort((a, b) => (asc ? a.v - b.v : b.v - a.v) || a.d - b.d);
    scLoad(); (scData[g] = scData[g] || {})[m] = list.slice(0, SC_MAX).map(e => ({ n: e.n, v: e.v, d: e.d }));
  }));
  scSave();
  return added;
}

function scImportFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const n = scImportData(JSON.parse(r.result)); scToast(n + (n > 1 ? ' scores importés' : ' score importé')); }
      catch (e) { scToast('Fichier de scores invalide'); }
    };
    r.readAsText(f);
  };
  inp.click();
}
function scBest(g, m) { const l = scList(g, m); return l.length ? l[0].v : null; }

// rang (0-based) qu'aurait ce score, ou -1 s'il n'entre pas dans le top
function scRank(g, m, v) {
  const l = scList(g, m), asc = SC_GAMES[g].dir === 'asc';
  let i = 0;
  while (i < l.length && (asc ? l[i].v <= v : l[i].v >= v)) i++;
  return i < SC_MAX ? i : -1;
}
function scAdd(g, m, v, n) {
  const rank = scRank(g, m, v), l = scList(g, m);
  const d = Date.now();
  l.splice(rank, 0, { n, v, d });
  scLoad(); (scData[g] = scData[g] || {})[m] = l.slice(0, SC_MAX).map(e => ({ n: e.n, v: e.v, d: e.d }));
  scSave();
  return d + '-' + n;
}

function scLastName() {
  try { const n = localStorage.getItem(SC_NAME_KEY); if (/^[A-Z]{3}$/.test(n)) return n; } catch (e) {}
  return 'AAA';
}

function scToast(txt) {
  const t = document.createElement('div');
  t.className = 'sc-toast'; t.textContent = txt;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function scClose() { if (scUI) { scUI.el.remove(); scUI = null; } }

function scOpen(handlers) {
  scClose();
  if (document.activeElement) document.activeElement.blur();
  const g = typeof activeGame !== 'undefined' && activeGame && GAMES[activeGame];
  if (g && g.pause) g.pause();
  const el = document.createElement('div');
  el.className = 'sc-back';
  el.innerHTML = '<div class="sc-panel" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(el);
  scUI = Object.assign({ el, panel: el.firstChild, t: Date.now() }, handlers);
  return scUI;
}

// Tant qu'une fenêtre de scores est ouverte, elle capte tout le clavier (le jeu en dessous ne reçoit rien)
window.addEventListener('keydown', e => {
  if (!scUI || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab') return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (Date.now() - scUI.t < 600) return;   // évite de valider par réflexe avec la touche du jeu
  scUI.key(e);
}, true);

// Soumet un score : si il entre dans le top, saisie du nom (3 lettres) puis affichage du tableau
function scSubmit(g, m, v, done) {
  const cfg = SC_GAMES[g], rank = scRank(g, m, v);
  if (rank < 0) { scToast(cfg.fmt(v) + ' — hors du top ' + SC_MAX); if (done) done(); return; }
  const letters = scLastName().split('');
  let pos = 0;
  const ui = scOpen({});
  const draw = () => {
    ui.panel.innerHTML =
      '<p class="sc-kicker">★ NOUVEAU SCORE ★</p>' +
      '<p class="sc-big">' + cfg.fmt(v) + '</p>' +
      '<p class="sc-sub">' + cfg.icon + ' ' + cfg.label + ' · ' + cfg.modes[m] + ' · rang n°' + (rank + 1) + '</p>' +
      '<div class="sc-slots">' + letters.map((l, i) =>
        '<div class="sc-slot' + (i === pos ? ' on' : '') + '">' +
        '<button class="sc-arrow" data-a="up" data-i="' + i + '" aria-label="Lettre suivante">▲</button>' +
        '<span class="sc-letter" data-a="sel" data-i="' + i + '">' + l + '</span>' +
        '<button class="sc-arrow" data-a="down" data-i="' + i + '" aria-label="Lettre précédente">▼</button></div>').join('') + '</div>' +
      '<p class="sc-hint">↑ ↓ change la lettre · ← → change de case<br>ou tape directement tes initiales · Entrée pour valider</p>' +
      '<div class="sc-actions"><button class="btn" data-a="skip">Passer</button><button class="btn sc-ok" data-a="ok">Valider</button></div>';
  };
  const shift = (i, d) => { letters[i] = String.fromCharCode((letters[i].charCodeAt(0) - 65 + d + 26) % 26 + 65); };
  const finish = save => {
    let id = null;
    if (save) {
      const name = letters.join('');
      try { localStorage.setItem(SC_NAME_KEY, name); } catch (e) {}
      id = scAdd(g, m, v, name);
    }
    scClose();
    if (save && typeof menuRefresh === 'function') menuRefresh();   // les records affichés sur les cartes du menu
    if (done) done();
    if (save) scShow(g, m, id);
  };
  ui.key = e => {
    if (e.key === 'ArrowUp') shift(pos, 1);
    else if (e.key === 'ArrowDown') shift(pos, -1);
    else if (e.key === 'ArrowLeft') pos = Math.max(0, pos - 1);
    else if (e.key === 'ArrowRight') pos = Math.min(2, pos + 1);
    else if (e.key === 'Backspace') pos = Math.max(0, pos - 1);
    else if (e.key === 'Enter') { finish(true); return; }
    else if (e.key === 'Escape') { finish(false); return; }
    else if (/^[a-zA-Z]$/.test(e.key)) { letters[pos] = e.key.toUpperCase(); pos = Math.min(2, pos + 1); }
    else return;
    draw();
  };
  ui.el.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, i = +b.dataset.i;
    if (a === 'ok') return finish(true);
    if (a === 'skip') return finish(false);
    if (a === 'up') { pos = i; shift(i, 1); }
    else if (a === 'down') { pos = i; shift(i, -1); }
    else if (a === 'sel') pos = i;
    draw();
  });
  draw();
}

// Tableau des meilleurs scores (g/m : jeu et mode affichés, hi : entrée à mettre en évidence)
function scShow(g, m, hi) {
  if (!SC_GAMES[g]) g = 'snake';
  const st = { g, m: (SC_GAMES[g].modes[m] !== undefined) ? String(m) : Object.keys(SC_GAMES[g].modes)[0] };
  const ui = scOpen({});
  const render = () => {
    const cfg = SC_GAMES[st.g], list = scList(st.g, st.m);
    let h = '<p class="sc-kicker">🏆 MEILLEURS SCORES</p>';
    h += '<div class="sc-tabs">' + SC_ORDER.map(k =>
      '<button class="sc-tab' + (k === st.g ? ' on' : '') + '" data-g="' + k + '">' + SC_GAMES[k].icon + ' ' + SC_GAMES[k].label + '</button>').join('') + '</div>';
    h += '<div class="sc-modes">' + Object.keys(cfg.modes).map(k =>
      '<button class="sc-mode' + (k === st.m ? ' on' : '') + '" data-m="' + k + '">' + cfg.modes[k] + '</button>').join('') + '</div>';
    h += '<div class="sc-table">';
    for (let i = 0; i < SC_MAX; i++) {
      const e = list[i];
      h += e
        ? '<div class="sc-row' + (e.id === hi ? ' hi' : '') + '"><span>' + (i + 1) + '.</span><span class="sc-n">' + e.n + '</span><span class="sc-v">' + cfg.fmt(e.v) + '</span><span class="sc-d">' + new Date(e.d).toLocaleDateString('fr-FR') + '</span></div>'
        : '<div class="sc-row empty"><span>' + (i + 1) + '.</span><span class="sc-n">---</span><span class="sc-v">-</span><span class="sc-d"></span></div>';
    }
    h += '</div><p class="sc-hint">← → mode · ↑ ↓ jeu · Échap pour fermer</p>' +
         '<div class="sc-actions"><button class="btn" data-a="reset">Effacer ce tableau</button><button class="btn sc-ok" data-a="close">Fermer</button></div>';
    ui.panel.innerHTML = h;
  };
  const step = (arr, cur, d) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
  ui.key = e => {
    const modes = Object.keys(SC_GAMES[st.g].modes);
    if (e.key === 'Escape' || e.key === 'Enter') { scClose(); return; }
    if (e.key === 'ArrowLeft')  st.m = step(modes, st.m, -1);
    else if (e.key === 'ArrowRight') st.m = step(modes, st.m, 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      st.g = step(SC_ORDER, st.g, e.key === 'ArrowUp' ? -1 : 1);
      st.m = Object.keys(SC_GAMES[st.g].modes)[0];
    } else return;
    hi = null; render();
  };
  ui.el.addEventListener('click', e => {
    if (e.target === ui.el) { scClose(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.g) { st.g = b.dataset.g; st.m = Object.keys(SC_GAMES[st.g].modes)[0]; hi = null; }
    else if (b.dataset.m) { st.m = b.dataset.m; hi = null; }
    else if (b.dataset.a === 'close') { scClose(); return; }
    else if (b.dataset.a === 'reset') {
      if (!confirm('Effacer ce tableau de scores ?')) return;
      if (scLoad()[st.g]) delete scData[st.g][st.m];
      scSave();
    }
    render();
  });
  render();
}
