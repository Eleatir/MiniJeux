/* ════════════════════════════════════════════
   WORDLE
════════════════════════════════════════════ */

// Normalise : supprime les accents pour la comparaison
function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const WD_ROWS = 6;
let wdLen, wdTarget, wdNormTarget, wdGuesses, wdCurrentRow, wdCurrentCol, wdOver, wdStart = null;
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
  document.getElementById('wdMsg').textContent = '';
  if (document.activeElement) document.activeElement.blur();
  wdRenderGrid(); wdRenderKeyboard();
}

function wdType(letter) {
  if (wdOver || wdCurrentCol >= wdLen) return;
  if (!wdStart) wdStart = Date.now();
  wdGuesses[wdCurrentRow][wdCurrentCol] = letter;
  wdCurrentCol++;
  wdRenderGrid();
}

function wdDelete() {
  if (wdOver || wdCurrentCol === 0) return;
  wdCurrentCol--;
  wdGuesses[wdCurrentRow][wdCurrentCol] = '';
  wdRenderGrid();
}

function wdSubmit() {
  if (wdOver) return;
  if (wdCurrentCol < wdLen) { wdMsg('Mot trop court !'); return; }
  const guess     = wdGuesses[wdCurrentRow].join('');
  const normGuess = normalize(guess);

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

  // Stocke le résultat sur la ligne
  wdGuesses[wdCurrentRow]._result = result;
  wdRenderGrid();
  wdUpdateKeyboard(guess, result);

  if (normGuess === wdNormTarget) {
    wdOver = true;
    wdMsg('Bravo ! Le mot était ' + wdTarget + ' 🎉');
    scSubmit('wordle', String(wdLen), (wdCurrentRow + 1) * 1000 + Math.min(999, Math.round((Date.now() - wdStart) / 1000)));
    return;
  }
  wdCurrentRow++; wdCurrentCol = 0;
  if (wdCurrentRow >= WD_ROWS) {
    wdOver = true;
    wdMsg('Perdu ! Le mot était : ' + wdTarget);
  }
}

function wdMsg(txt) {
  document.getElementById('wdMsg').textContent = txt;
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
      if (result) {
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
  stop() { document.removeEventListener('keydown', wdKeyHandler); }
};
