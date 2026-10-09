/* ════════════════════════════════════════════
   DÉMINEUR
════════════════════════════════════════════ */
const MS_CONFIGS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 }
};
let msCfg, msBoard, msRevealed, msFlagged, msMines,
    msOver, msStarted, msTimer, msElapsed, msStart, msLost;

let msDiffKey = 'medium';

// ── commandes tactiles : appui long = drapeau ; bouton « Drapeau » = chaque toucher pose / retire un drapeau ──
let msFlagMode = false, msLastTouch = 0, msPausedAt = 0;

function msStartTimer() {
  clearInterval(msTimer);
  msTimer = setInterval(() => { msElapsed++; document.getElementById('timer').textContent = msElapsed + 's'; }, 1000);
}

function msSetFlagMode(on) {
  msFlagMode = on;
  const b = document.getElementById('msFlagBtn');
  if (!b) return;
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  b.textContent = on ? '🚩 Drapeau : oui' : '🚩 Drapeau : non';
}

function msInitTouch(grid) {
  let timer = null, long = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  grid.addEventListener('touchstart', e => {
    msLastTouch = Date.now();
    const c = e.target.closest('.cell');
    long = null;
    if (!c) return;
    timer = setTimeout(() => { long = [+c.dataset.r, +c.dataset.c]; if (navigator.vibrate) navigator.vibrate(15); }, 450);
  }, { passive: true });
  grid.addEventListener('touchmove', cancel, { passive: true });
  grid.addEventListener('touchcancel', () => { cancel(); long = null; });
  grid.addEventListener('touchend', e => {
    cancel();
    msLastTouch = Date.now();
    if (long) { e.preventDefault(); const [r, c] = long; long = null; msToggleFlag(r, c); }   // pose du drapeau au relâchement, sans clic derrière
  });
}

function initMinesweeper(saved) {
  if (saved) document.getElementById('diff').value = saved.diff;
  msDiffKey  = document.getElementById('diff').value;
  msCfg      = MS_CONFIGS[msDiffKey];
  msBoard    = Array(msCfg.rows).fill(null).map(() => Array(msCfg.cols).fill(0));
  msRevealed = Array(msCfg.rows).fill(null).map(() => Array(msCfg.cols).fill(false));
  msFlagged  = Array(msCfg.rows).fill(null).map(() => Array(msCfg.cols).fill(false));
  msMines    = new Set();
  msOver     = false; msStarted = false; msElapsed = 0; msLost = false;
  clearInterval(msTimer);
  document.getElementById('timer').textContent     = '0s';
  document.getElementById('mineCount').textContent = msCfg.mines;
  document.getElementById('msBanner').className    = 'banner';
  document.getElementById('msBanner').textContent  = '';
  document.getElementById('resetBtn').onclick      = () => { document.activeElement.blur(); confirmAbandon(() => initMinesweeper(), 'Rejouer'); };
  document.getElementById('diff').onchange         = () => {
    const sel = document.getElementById('diff');
    sel.blur(); confirmChange(sel, msDiffKey, () => initMinesweeper(), 'Rejouer');
  };
  if (saved) {   // reprise d'une partie en cours
    msMines = new Set(saved.mines); msBoard = saved.board; msRevealed = saved.revealed; msFlagged = saved.flagged;
    msStarted = true; msStart = Date.now() - saved.elapsed; msElapsed = Math.floor(saved.elapsed / 1000);
    document.getElementById('timer').textContent = msElapsed + 's';
    msStartTimer();
    msUpdateCount();
  }
  msSetFlagMode(false);
  document.getElementById('msFlagBtn').onclick = () => msSetFlagMode(!msFlagMode);
  const grid = document.getElementById('msGrid');
  if (!grid.dataset.touch) { grid.dataset.touch = '1'; msInitTouch(grid); }
  msShowBest();
  msRender();
}

function msPlaceMines(skipR, skipC) {
  const excl = new Set();
  for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
    const r=skipR+dr, c=skipC+dc;
    if (r>=0&&r<msCfg.rows&&c>=0&&c<msCfg.cols) excl.add(r*msCfg.cols+c);
  }
  while (msMines.size < msCfg.mines) {
    const idx = Math.floor(Math.random()*msCfg.rows*msCfg.cols);
    if (!excl.has(idx)) msMines.add(idx);
  }
  for (let r=0;r<msCfg.rows;r++) for (let c=0;c<msCfg.cols;c++)
    msBoard[r][c] = msMines.has(r*msCfg.cols+c) ? -1 : 0;
  for (let r=0;r<msCfg.rows;r++) for (let c=0;c<msCfg.cols;c++) {
    if (msBoard[r][c]===-1) continue;
    let n=0;
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
      const nr=r+dr,nc=c+dc;
      if (nr>=0&&nr<msCfg.rows&&nc>=0&&nc<msCfg.cols&&msBoard[nr][nc]===-1) n++;
    }
    msBoard[r][c]=n;
  }
}

function msReveal(r, c) {
  if (r<0||r>=msCfg.rows||c<0||c>=msCfg.cols||msRevealed[r][c]||msFlagged[r][c]) return;
  msRevealed[r][c]=true;
  if (msBoard[r][c]===0)
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) msReveal(r+dr,c+dc);
}

// Nombre de voisines (drapeaux) autour d'une case
function msCountAround(r, c, grid) {
  let n=0;
  for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
    const nr=r+dr, nc=c+dc;
    if ((dr||dc)&&nr>=0&&nr<msCfg.rows&&nc>=0&&nc<msCfg.cols&&grid[nr][nc]) n++;
  }
  return n;
}

// Chording : sur un chiffre dont les drapeaux sont tous posés, révèle les voisines non marquées
function msChord(r, c) {
  if (msOver||!msRevealed[r][c]||msBoard[r][c]<=0) return;
  if (msCountAround(r,c,msFlagged)!==msBoard[r][c]) return;
  let hit=null;
  for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
    const nr=r+dr, nc=c+dc;
    if (nr<0||nr>=msCfg.rows||nc<0||nc>=msCfg.cols||msFlagged[nr][nc]||msRevealed[nr][nc]) continue;
    if (msBoard[nr][nc]===-1) { msRevealed[nr][nc]=true; hit=hit||[nr,nc]; }
    else msReveal(nr,nc);
  }
  Sfx.play('click');
  if (hit) { msEnd(false,hit[0],hit[1]); return; }
  msCheckWin(); msRender();
}

function msClick(r, c) {
  if (msOver) return;
  if (msRevealed[r][c]) { msChord(r,c); return; }
  if (msFlagged[r][c]) return;
  if (!msStarted) {
    msPlaceMines(r,c); msStarted=true; msStart=Date.now(); Stats.played('minesweeper', msDiffKey);
    msStartTimer();
  }
  if (msBoard[r][c]===-1) { msRevealed[r][c]=true; msEnd(false,r,c); return; }
  Sfx.play('click');
  msReveal(r,c); msCheckWin(); msRender();
}

function msToggleFlag(r, c) {
  if (msOver||msRevealed[r][c]) return;
  // pas plus de drapeaux que de mines : le compteur ne devient jamais négatif
  if (!msFlagged[r][c] && msFlagged.flat().filter(Boolean).length>=msCfg.mines) { Sfx.play('bad'); return; }
  msFlagged[r][c]=!msFlagged[r][c];
  Sfx.play('place');
  msUpdateCount();
  msRender();
}

function msEnd(win, hitR, hitC) {
  msOver=true; clearInterval(msTimer);
  for (let r=0;r<msCfg.rows;r++) for (let c=0;c<msCfg.cols;c++) {
    if (!msMines.has(r*msCfg.cols+c)) continue;
    if (win) msFlagged[r][c]=true;                       // victoire : toutes les mines sont marquées
    else if (!msFlagged[r][c]) msRevealed[r][c]=true;    // défaite : on montre les mines non marquées
  }
  msLost = !win;
  msUpdateCount();
  msRender();
  Sfx.play(win ? 'win' : 'boom');
  if (win) Fx.confetti();
  if (!win && hitR!==undefined) {
    const el=document.querySelector(`[data-r="${hitR}"][data-c="${hitC}"]`);
    if (el) el.classList.add('mine-hit');
  }
  const b=document.getElementById('msBanner');
  b.textContent = win ? 'Bravo, toutes les mines sont déminées !' : 'Boom ! Tu as déclenché une mine.';
  b.className   = 'banner '+(win?'win':'lose');
  if (win) scSubmit('minesweeper', document.getElementById('diff').value, Math.round((Date.now()-msStart)/10), msShowBest);
}

function msUpdateCount() {
  const flags=msFlagged.flat().filter(Boolean).length;
  document.getElementById('mineCount').textContent=msCfg.mines-flags;
}

function msShowBest() {
  const el = document.getElementById('msBest');
  if (!el) return;
  const best = scBest('minesweeper', document.getElementById('diff').value);
  el.textContent = best === null ? '—' : SC_GAMES.minesweeper.fmt(best);
}

function msCheckWin() {
  let safe=0;
  for (let r=0;r<msCfg.rows;r++) for (let c=0;c<msCfg.cols;c++)
    if (msRevealed[r][c]&&!msMines.has(r*msCfg.cols+c)) safe++;
  if (safe===msCfg.rows*msCfg.cols-msCfg.mines) msEnd(true);
}

function msRender() {
  const g=document.getElementById('msGrid');
  g.style.gridTemplateColumns=`repeat(${msCfg.cols},var(--cell))`;
  g.style.setProperty('--cols', msCfg.cols);
  g.innerHTML='';
  for (let r=0;r<msCfg.rows;r++) for (let c=0;c<msCfg.cols;c++) {
    const d=document.createElement('div');
    d.className='cell'; d.dataset.r=r; d.dataset.c=c;
    if (msRevealed[r][c]) {
      d.classList.add('revealed');
      if (msBoard[r][c]===-1) d.textContent='💣';
      else if (msBoard[r][c]>0) { d.textContent=msBoard[r][c]; d.classList.add('n'+msBoard[r][c]); }
    } else if (msFlagged[r][c]) {
      if (msLost && !msMines.has(r*msCfg.cols+c)) { d.textContent='❌'; d.classList.add('wrong-flag'); }  // drapeau mal placé
      else d.textContent='🚩';
    }
    d.addEventListener('click',()=>{ if (msFlagMode && !msRevealed[r][c]) msToggleFlag(r,c); else msClick(r,c); });
    d.addEventListener('contextmenu',e=>{ e.preventDefault(); if (Date.now()-msLastTouch>1500) msToggleFlag(r,c); });   // un appui long tactile est géré à part
    d.addEventListener('auxclick',e=>{ if (e.button===1) { e.preventDefault(); msChord(r,c); } });  // clic molette = chording
    g.appendChild(d);
  }
}


GAMES.minesweeper = {
  wide: true,   // la grille « Difficile » (30 colonnes) dépasse la largeur standard
  start(saved) { initMinesweeper(saved); },
  stop()  { clearInterval(msTimer); msPausedAt = 0; },
  inProgress() { return msStarted && !msOver; },
  canPause() { return !msOver; },
  pause() { clearInterval(msTimer); msPausedAt = Date.now(); },
  resume() { if (msStarted && !msOver) { msStart += Date.now() - msPausedAt; msStartTimer(); } msPausedAt = 0; },
  save() {
    if (!GAMES.minesweeper.inProgress()) return null;
    return { diff: msDiffKey, mines: [...msMines], board: msBoard, revealed: msRevealed, flagged: msFlagged, elapsed: (msPausedAt || Date.now()) - msStart };
  }
};
