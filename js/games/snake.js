/* ════════════════════════════════════════════
   SNAKE
════════════════════════════════════════════ */
const SN_SPEEDS = { slow: 180, medium: 110, fast: 60 };
const SN_COLS = 20, SN_ROWS = 20;

let snLoop, snDir, snQueue = [], snBody, snFood, snScore, snBest = 0, snRunning, snDiff;

function snStop() { clearInterval(snLoop); snRunning = false; }

function snKeyHandler(e) {
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
  if (!document.getElementById('snCanvas')) return;
  // Démarrer ou redémarrer si en attente
  if (!snRunning) {
    initSnake();
    // Au départ le corps est à gauche de la tête : on ignore ← (mort immédiate)
    if (dir === 'L') return;
    snDir = dir; snQueue = [];
    snRunning = true;
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
  ov.innerHTML = '<p>🐍 Snake</p><small>Flèches ou ZQSD pour démarrer</small>';
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
    snScore++;
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
  const ov = document.getElementById('snOverlay');
  ov.style.display = 'flex';
  ov.innerHTML = '<p>' + (win ? '🏆 Grille complète !' : '💀 Game over') + '</p><small>Score : ' + snScore + ' &nbsp;·&nbsp; Flèches ou ZQSD pour rejouer</small>';
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
    initSnake();
    const reset = () => { if (document.activeElement) document.activeElement.blur(); initSnake(); };
    document.getElementById('snReset').addEventListener('click', reset);
    document.getElementById('snDiff').addEventListener('change', reset);
  },
  stop() { snStop(); document.removeEventListener('keydown', snKeyHandler); }
};
