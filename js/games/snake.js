/* ════════════════════════════════════════════
   SNAKE
════════════════════════════════════════════ */
const SN_SPEEDS = { slow: 180, medium: 110, fast: 60 };
const SN_COLS = 20, SN_ROWS = 20;

let snLoop, snDir, snQueue = [], snBody, snFood, snScore, snBest = 0, snRunning, snDiff, snPaused = false;

function snStop() { clearInterval(snLoop); snRunning = false; snPaused = false; }

// Pause : Espace ou P ; automatique quand la fenêtre ou l'onglet perd le focus
function snPause(on) {
  if (!snRunning || on === snPaused) return;
  snPaused = on;
  const ov = document.getElementById('snOverlay');
  if (on) {
    clearInterval(snLoop);
    ov.style.display = 'flex';
    ov.innerHTML = '<p>⏸ Pause</p><small><span class="only-desktop">Espace pour reprendre</span><span class="only-mobile">Touche l\'écran ou ⏸ pour reprendre</span></small>';
  } else {
    ov.style.display = 'none';
    snLoop = setInterval(snTick, SN_SPEEDS[snDiff]);
  }
}
function snAutoPause(e) { if (e.type === 'blur' || document.hidden) snPause(true); }

// Commandes tactiles : glisser sur la grille (virages enchaînés sans lever le doigt), manette, bouton pause, toucher pour démarrer/reprendre
function snInitTouch() {
  const cv = document.getElementById('snCanvas'), wrap = cv.parentElement;
  let anchor = null, moved = false;
  wrap.addEventListener('touchstart', e => { const t = e.touches[0]; anchor = { x: t.clientX, y: t.clientY }; moved = false; }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (!anchor) return;
    const t = e.touches[0], dx = t.clientX - anchor.x, dy = t.clientY - anchor.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    moved = true;
    snInput(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
    anchor = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    if (anchor && !moved) {                         // simple toucher : démarrer, rejouer ou reprendre après une pause
      if (snPaused) snPause(false);
      else if (!snRunning) snInput('R');
      e.preventDefault();
    }
    anchor = null;
  });
  document.querySelectorAll('#snPad [data-dir]').forEach(b =>
    b.addEventListener('pointerdown', e => { e.preventDefault(); snInput(b.dataset.dir); }));
  document.getElementById('snPause').addEventListener('pointerdown', e => { e.preventDefault(); if (snRunning) snPause(!snPaused); });
}

function snKeyHandler(e) {
  if ((e.key === ' ' || e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (snRunning) snPause(!snPaused);
    return;
  }
  const map = {
    ArrowUp:'U', ArrowDown:'D', ArrowLeft:'L', ArrowRight:'R',
    z:'U', Z:'U', s:'D', S:'D', q:'L', Q:'L', d:'R', D:'R'
  };
  const dir = map[e.key];
  if (!dir || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  snInput(dir);
}

function snInput(dir) {
  if (!document.getElementById('snCanvas') || snPaused) return;
  // Démarrer ou redémarrer si en attente
  if (!snRunning) {
    initSnake();
    // Au départ le corps est à gauche de la tête : on ignore ← (mort immédiate)
    if (dir === 'L') return;
    snDir = dir; snQueue = [];
    snRunning = true; Sfx.play('click'); Stats.played('snake', snDiff);
    document.getElementById('snOverlay').style.display = 'none';
    const speed = SN_SPEEDS[document.getElementById('snDiff').value];
    snLoop = setInterval(snTick, speed);
    return;
  }
  // Les directions sont mises en file (3 max) : un tick joue une direction, donc deux appuis rapides ne se perdent plus.
  // Le demi-tour est interdit par rapport à la dernière direction retenue.
  const opp = { U:'D', D:'U', L:'R', R:'L' };
  const last = snQueue.length ? snQueue[snQueue.length - 1] : snDir;
  if (dir !== last && dir !== opp[last] && snQueue.length < 3) snQueue.push(dir);
}

function initSnake() {
  snStop();
  snDiff   = document.getElementById('snDiff') ? document.getElementById('snDiff').value : 'medium';
  snBest   = scBest('snake', snDiff) || 0;
  snDir    = 'R'; snQueue = [];
  snBody   = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  snScore  = 0;
  snRunning = false;
  snPlaceFood();
  document.getElementById('snScore').textContent = 0;
  document.getElementById('snBest').textContent  = snBest;
  const ov = document.getElementById('snOverlay');
  ov.style.display = 'flex';
  ov.innerHTML = '<p>🐍 Snake</p><small><span class="only-desktop">Flèches ou ZQSD pour démarrer · Espace = pause</span><span class="only-mobile">Glisse ou touche une flèche pour démarrer</span></small>';
  snDraw();
}

function snPlaceFood() {
  if (snBody.length >= SN_COLS * SN_ROWS) { snFood = { x:-1, y:-1 }; return; }
  const occupied = new Set(snBody.map(s => s.x + ',' + s.y));
  let f;
  do { f = { x: Math.floor(Math.random()*SN_COLS), y: Math.floor(Math.random()*SN_ROWS) }; }
  while (occupied.has(f.x + ',' + f.y));
  snFood = f;
}

function snTick() {
  if (snQueue.length) snDir = snQueue.shift();
  const head = snBody[0];
  const nx = (head.x + (snDir==='R'?1:snDir==='L'?-1:0) + SN_COLS) % SN_COLS;
  const ny = (head.y + (snDir==='D'?1:snDir==='U'?-1:0) + SN_ROWS) % SN_ROWS;

  // Collision corps
  if (snBody.some(s => s.x===nx && s.y===ny)) { snGameOver(); return; }

  snBody.unshift({x:nx, y:ny});
  if (nx===snFood.x && ny===snFood.y) {
    snScore++; Sfx.play('eat');
    if (snScore > snBest) snBest = snScore;
    document.getElementById('snScore').textContent = snScore;
    document.getElementById('snBest').textContent  = snBest;
    snPlaceFood();
    if (snFood.x < 0) { snDraw(); snGameOver(true); return; }
  } else {
    snBody.pop();
  }
  snDraw();
}

function snGameOver(win) {
  snStop();
  Sfx.play(win ? 'win' : 'lose');
  if (win) Fx.confetti();
  const ov = document.getElementById('snOverlay');
  ov.style.display = 'flex';
  ov.innerHTML = '<p>' + (win ? '🏆 Grille complète !' : '💀 Game over') + '</p><small>Score : ' + snScore + ' &nbsp;·&nbsp; <span class="only-desktop">Flèches ou ZQSD pour rejouer</span><span class="only-mobile">Glisse ou touche une flèche pour rejouer</span></small>';
  // Relancer sur prochaine touche directionnelle (géré dans snKeyHandler via snRunning=false)
  if (snScore > 0) scSubmit('snake', snDiff, snScore);
}

function snDraw() {
  const canvas = document.getElementById('snCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cw = W / SN_COLS, ch = H / SN_ROWS;

  // Fond
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  ctx.fillStyle = isDark ? '#2a2a28' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Grille légère
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  for (let x=0;x<=SN_COLS;x++) { ctx.beginPath(); ctx.moveTo(x*cw,0); ctx.lineTo(x*cw,H); ctx.stroke(); }
  for (let y=0;y<=SN_ROWS;y++) { ctx.beginPath(); ctx.moveTo(0,y*ch); ctx.lineTo(W,y*ch); ctx.stroke(); }

  // Nourriture
  ctx.fillStyle = '#a32d2d';
  ctx.beginPath();
  ctx.arc((snFood.x+0.5)*cw, (snFood.y+0.5)*ch, cw*0.35, 0, Math.PI*2);
  ctx.fill();

  // Corps
  snBody.forEach((s, i) => {
    ctx.fillStyle = i === 0
      ? (isDark ? '#c0dd97' : '#3b6d11')
      : (isDark ? '#5dcaa5' : '#0f6e56');
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(s.x*cw+pad, s.y*ch+pad, cw-pad*2, ch-pad*2, 3);
    ctx.fill();
  });
}


GAMES.snake = {
  start() {
    document.addEventListener('keydown', snKeyHandler);
    snInitTouch();
    document.addEventListener('visibilitychange', snAutoPause);
    window.addEventListener('blur', snAutoPause);
    initSnake();
    document.getElementById('snReset').addEventListener('click', () => {
      document.activeElement.blur();
      confirmAbandon(initSnake, 'Rejouer');
    });
    const sel = document.getElementById('snDiff');
    sel.addEventListener('change', () => { sel.blur(); confirmChange(sel, snDiff, initSnake, 'Rejouer'); });
  },
  inProgress() { return !!snRunning; },
  pause() { snPause(true); },
  stop() {
    snStop();
    document.removeEventListener('keydown', snKeyHandler);
    document.removeEventListener('visibilitychange', snAutoPause);
    window.removeEventListener('blur', snAutoPause);
  }
};
