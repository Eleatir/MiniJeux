/* ════════════════════════════════════════════
   WORDLE
════════════════════════════════════════════ */

// Normalise : supprime les accents pour la comparaison
function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const WD_ROWS = 6;
let wdLen, wdTarget, wdNormTarget, wdGuesses, wdCurrentRow, wdCurrentCol, wdOver, wdStart = null;
let wdBusy = false, wdToken = 0, wdMsgTimer = null;   // wdBusy : révélation d'une ligne en cours
const WD_KB = [
  ['A','Z','E','R','T','Y','U','I','O','P'],
  ['Q','S','D','F','G','H','J','K','L','M'],
  ['Entrée','W','X','C','V','B','N','←']
];
function wdKeyHandler(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter')     { wdSubmit(); return; }
  if (e.key === 'Backspace') { wdDelete(); return; }
  const l = e.key.toUpperCase();
  if (/^[A-Z]$/.test(l)) wdType(l);
}

function initWordle() {
  wdLen        = parseInt(document.getElementById('wdLen').value);
  const pool   = WD_WORDS[wdLen];
  wdTarget     = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
  wdNormTarget = normalize(wdTarget);
  wdGuesses    = Array(WD_ROWS).fill(null).map(() => Array(wdLen).fill(''));
  wdCurrentRow = 0; wdCurrentCol = 0; wdOver = false; wdKeyColors = {}; wdStart = null;
  wdBusy = false; wdToken++;
  wdMsg('');
  if (document.activeElement) document.activeElement.blur();
  wdRenderGrid(); wdRenderKeyboard();
}

function wdType(letter) {
  if (wdOver || wdBusy || wdCurrentCol >= wdLen) return;
  if (!wdStart) wdStart = Date.now();
  wdGuesses[wdCurrentRow][wdCurrentCol] = letter;
  wdCurrentCol++;
  wdRenderGrid();
}

function wdDelete() {
  if (wdOver || wdBusy || wdCurrentCol === 0) return;
  wdCurrentCol--;
  wdGuesses[wdCurrentRow][wdCurrentCol] = '';
  wdRenderGrid();
}

function wdSubmit() {
  if (wdOver || wdBusy) return;
  if (wdCurrentCol < wdLen) { wdMsg('Mot trop court !'); wdShake(); Sfx.play('bad'); return; }
  const guess     = wdGuesses[wdCurrentRow].join('');
  const normGuess = normalize(guess);
  if (!WD_DICT[wdLen].has(normGuess)) { wdMsg('Ce mot n\'est pas dans le dictionnaire'); wdShake(); Sfx.play('bad'); return; }

  // Calcul des couleurs
  const result  = Array(wdLen).fill('absent');
  const tCount  = {};
  for (const ch of wdNormTarget) tCount[ch] = (tCount[ch]||0) + 1;

  // Passe 1 : corrects
  for (let i=0;i<wdLen;i++) {
    const g = normalize(guess[i]);
    if (g === wdNormTarget[i]) { result[i]='correct'; tCount[g]--; }
  }
  // Passe 2 : présents
  for (let i=0;i<wdLen;i++) {
    if (result[i]==='correct') continue;
    const g = normalize(guess[i]);
    if (tCount[g] > 0) { result[i]='present'; tCount[g]--; }
  }

  // Stocke le résultat sur la ligne ; les couleurs apparaissent lettre par lettre (révélation)
  const row = wdCurrentRow, tok = wdToken;
  wdGuesses[row]._result = result;
  wdGuesses[row]._pending = true;
  wdBusy = true;
  wdRenderGrid();
  wdReveal(row, result, () => {
    if (tok !== wdToken) return;            // une nouvelle partie a démarré entre-temps
    wdGuesses[row]._pending = false;
    wdBusy = false;
    wdRenderGrid();
    wdUpdateKeyboard(guess, result);

    if (normGuess === wdNormTarget) {
      wdOver = true;
      wdMsg('Bravo ! Le mot était ' + wdTarget + ' 🎉', true);
      wdCelebrate(row);
      Sfx.play('win');
      scSubmit('wordle', String(wdLen), (row + 1) * 1000 + Math.min(999, Math.round((Date.now() - wdStart) / 1000)));
      return;
    }
    wdCurrentRow++; wdCurrentCol = 0;
    wdRenderGrid();
    if (wdCurrentRow >= WD_ROWS) {
      wdOver = true;
      wdMsg('Perdu ! Le mot était : ' + wdTarget, true);
      Sfx.play('lose');
    }
  });
}

// Retourne les tuiles une à une ; à mi-retournement elles prennent leur couleur
function wdReveal(row, result, done) {
  const tiles = [...document.querySelectorAll('#wdGrid .wd-row')[row].children];
  if (!motionOK()) { tiles.forEach((t, i) => t.classList.add(result[i])); done(); return; }
  let left = tiles.length;
  tiles.forEach((t, i) => {
    const a = t.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }], { duration: 170, delay: i * 200, fill: 'forwards' });
    a.onfinish = () => {
      t.classList.add(result[i]);
      Sfx.play(result[i] === 'correct' ? 'good' : 'tick');
      const b = t.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }], { duration: 170 });
      a.cancel();
      b.onfinish = () => { if (--left === 0) done(); };
    };
  });
}

function wdShake() {
  const r = document.querySelectorAll('#wdGrid .wd-row')[wdCurrentRow];
  if (!r || !motionOK()) return;
  r.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' },
             { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 350 });
}

function wdCelebrate(row) {
  if (!motionOK()) return;
  [...document.querySelectorAll('#wdGrid .wd-row')[row].children].forEach((t, i) =>
    t.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }], { duration: 450, delay: i * 90 }));
}

// Message temporaire (disparaît seul) ; sticky = message de fin de partie, qui reste
function wdMsg(txt, sticky) {
  const el = document.getElementById('wdMsg');
  if (!el) return;
  clearTimeout(wdMsgTimer);
  el.textContent = txt;
  if (txt && !sticky) wdMsgTimer = setTimeout(() => { el.textContent = ''; }, 2200);
}

function wdRenderGrid() {
  const g = document.getElementById('wdGrid');
  g.innerHTML = '';
  for (let r=0;r<WD_ROWS;r++) {
    const row = document.createElement('div');
    row.className = 'wd-row';
    const result = wdGuesses[r]._result;
    for (let c=0;c<wdLen;c++) {
      const tile = document.createElement('div');
      tile.className = 'wd-tile';
      tile.textContent = wdGuesses[r][c];
      if (result && !wdGuesses[r]._pending) {
        tile.classList.add(result[c]);
      } else if (r === wdCurrentRow) {
        tile.classList.add('active-row');
      }
      row.appendChild(tile);
    }
    g.appendChild(row);
  }
}

let wdKeyColors = {};
function wdUpdateKeyboard(guess, result) {
  const priority = { correct:3, present:2, absent:1 };
  for (let i=0;i<wdLen;i++) {
    const letter = guess[i];
    const cur    = wdKeyColors[letter];
    const next   = result[i];
    if (!cur || priority[next] > priority[cur]) wdKeyColors[letter] = next;
  }
  wdRenderKeyboard();
}

function wdRenderKeyboard() {
  const kb = document.getElementById('wdKeyboard');
  kb.innerHTML = '';
  WD_KB.forEach(rowKeys => {
    const row = document.createElement('div');
    row.className = 'wd-kb-row';
    rowKeys.forEach(k => {
      const btn = document.createElement('div');
      btn.className = 'wd-key' + (k.length > 1 ? ' wide' : '');
      btn.textContent = k;
      const color = wdKeyColors[k];
      if (color) btn.classList.add(color);
      btn.addEventListener('click', () => {
        if (k === 'Entrée') wdSubmit();
        else if (k === '←') wdDelete();
        else wdType(k);
      });
      row.appendChild(btn);
    });
    kb.appendChild(row);
  });
}


GAMES.wordle = {
  start() {
    document.addEventListener('keydown', wdKeyHandler);
    initWordle();
    document.getElementById('wdReset').addEventListener('click', initWordle);
    document.getElementById('wdLen').addEventListener('change', initWordle);
  },
  stop() { wdToken++; wdBusy = false; clearTimeout(wdMsgTimer); document.removeEventListener('keydown', wdKeyHandler); }
};
