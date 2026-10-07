/* ════════════════════════════════════════════
   2048
════════════════════════════════════════════ */
const TF_N = 4;
let tfBoard, tfScore, tfBest = 0, tfOver, tfPaused, tfKeep, tfNew = -1;

function tfKeyHandler(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = {
    ArrowUp:'U', ArrowDown:'D', ArrowLeft:'L', ArrowRight:'R',
    z:'U', Z:'U', s:'D', S:'D', q:'L', Q:'L', d:'R', D:'R'
  };
  const dir = map[e.key];
  if (!dir) return;
  e.preventDefault();
  tfMove(dir);
}

function initTf() {
  tfBoard = Array.from({ length: TF_N }, () => Array(TF_N).fill(0));
  tfBest = scBest('2048', 'all') || 0;
  tfScore = 0; tfOver = false; tfPaused = false; tfKeep = false; tfNew = -1;
  tfAdd(); tfAdd();
  const b = document.getElementById('tfBanner');
  b.className = 'banner'; b.textContent = '';
  document.getElementById('tfReset').onclick = () => { document.activeElement.blur(); initTf(); };
  tfRender();
}

function tfAdd() {
  const empty = [];
  for (let r = 0; r < TF_N; r++) for (let c = 0; c < TF_N; c++) if (!tfBoard[r][c]) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  tfBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
  tfNew = r * TF_N + c;
}

function tfSlide(line) {
  const a = line.filter(v => v);
  let gain = 0;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] === a[i + 1]) { a[i] *= 2; gain += a[i]; a.splice(i + 1, 1); }
  }
  while (a.length < line.length) a.push(0);
  return { line: a, gain, moved: a.some((v, i) => v !== line[i]) };
}

function tfMove(dir) {
  if (tfOver || tfPaused || !document.getElementById('tfBoard')) return;
  let moved = false, gain = 0;
  for (let k = 0; k < TF_N; k++) {
    const coords = [];
    for (let t = 0; t < TF_N; t++) {
      coords.push(dir === 'L' ? [k, t] : dir === 'R' ? [k, TF_N - 1 - t] : dir === 'U' ? [t, k] : [TF_N - 1 - t, k]);
    }
    const res = tfSlide(coords.map(([r, c]) => tfBoard[r][c]));
    res.line.forEach((v, t) => { const [r, c] = coords[t]; tfBoard[r][c] = v; });
    if (res.moved) moved = true;
    gain += res.gain;
  }
  if (!moved) return;
  tfScore += gain;
  if (tfScore > tfBest) tfBest = tfScore;
  tfAdd();
  tfRender();
  const banner = document.getElementById('tfBanner');
  if (!tfKeep && tfBoard.flat().includes(2048)) {
    tfPaused = true;
    banner.className = 'banner win';
    banner.innerHTML = 'Bravo, tu as atteint 2048 ! <button class="btn" id="tfContinue">Continuer</button><button class="btn" id="tfSave">Enregistrer mon score</button>';
    document.getElementById('tfSave').onclick = () => { document.activeElement.blur(); scSubmit('2048', 'all', tfScore); };
    document.getElementById('tfContinue').onclick = () => {
      tfKeep = true; tfPaused = false; banner.className = 'banner'; banner.textContent = '';
      document.activeElement.blur();
    };
  } else if (!tfCanMove()) {
    tfOver = true;
    banner.className = 'banner lose';
    banner.textContent = 'Plus de mouvement possible. Score : ' + tfScore;
    if (tfScore > 0) scSubmit('2048', 'all', tfScore);
  }
}

function tfCanMove() {
  for (let r = 0; r < TF_N; r++) for (let c = 0; c < TF_N; c++) {
    if (!tfBoard[r][c]) return true;
    if (c + 1 < TF_N && tfBoard[r][c] === tfBoard[r][c + 1]) return true;
    if (r + 1 < TF_N && tfBoard[r][c] === tfBoard[r + 1][c]) return true;
  }
  return false;
}

function tfRender() {
  const g = document.getElementById('tfBoard');
  g.innerHTML = '';
  tfBoard.flat().forEach((v, i) => {
    const d = document.createElement('div');
    d.className = 'tf-cell' + (v ? ' ' + (v <= 2048 ? 'tf-' + v : 'tf-big') : '') + (i === tfNew ? ' pop' : '');
    d.textContent = v || '';
    g.appendChild(d);
  });
  document.getElementById('tfScore').textContent = tfScore;
  document.getElementById('tfBest').textContent = tfBest;
}


GAMES['2048'] = {
  start() { document.addEventListener('keydown', tfKeyHandler); initTf(); },
  stop()  { document.removeEventListener('keydown', tfKeyHandler); }
};
