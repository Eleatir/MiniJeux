/* ════════════════════════════════════════════
   2048
════════════════════════════════════════════ */
const TF_N = 4;
let tfBoard, tfScore, tfBest = 0, tfOver, tfPaused, tfKeep, tfNew = -1, tfCounted = false;

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

function initTf(saved) {
  tfBoard = Array.from({ length: TF_N }, () => Array(TF_N).fill(0));
  tfBest = scBest('2048', 'all') || 0;
  tfScore = 0; tfOver = false; tfPaused = false; tfKeep = false; tfNew = -1; tfCounted = false;
  if (saved) { tfBoard = saved.board; tfScore = saved.score; tfKeep = saved.keep; tfCounted = true; if (tfScore > tfBest) tfBest = tfScore; }
  else { tfAdd(); tfAdd(); }
  const b = document.getElementById('tfBanner');
  b.className = 'banner'; b.textContent = '';
  document.getElementById('tfReset').onclick = () => { document.activeElement.blur(); confirmAbandon(() => initTf(), 'Nouvelle partie'); };
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

// Fait glisser une ligne vers l'indice 0. Renvoie aussi, pour l'animation, le trajet de chaque tuile
// (moves : {from, to, v}) et les cases d'arrivée issues d'une fusion (merged).
function tfSlide(line) {
  const items = [];
  line.forEach((v, i) => { if (v) items.push({ v, from: i }); });
  const out = [], moves = [], merged = [];
  let gain = 0;
  for (let i = 0; i < items.length; i++) {
    const to = out.length;
    if (i + 1 < items.length && items[i].v === items[i + 1].v) {
      out.push(items[i].v * 2); gain += items[i].v * 2; merged.push(to);
      moves.push({ from: items[i].from, to, v: items[i].v }, { from: items[i + 1].from, to, v: items[i + 1].v });
      i++;
    } else {
      out.push(items[i].v);
      moves.push({ from: items[i].from, to, v: items[i].v });
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gain, moved: out.some((v, i) => v !== line[i]), moves, merged };
}

function tfMove(dir) {
  if (tfOver || tfPaused || !document.getElementById('tfBoard')) return;
  let moved = false, gain = 0;
  const anim = { moves: [], merged: new Set() };
  for (let k = 0; k < TF_N; k++) {
    const coords = [];
    for (let t = 0; t < TF_N; t++) {
      coords.push(dir === 'L' ? [k, t] : dir === 'R' ? [k, TF_N - 1 - t] : dir === 'U' ? [t, k] : [TF_N - 1 - t, k]);
    }
    const res = tfSlide(coords.map(([r, c]) => tfBoard[r][c]));
    res.line.forEach((v, t) => { const [r, c] = coords[t]; tfBoard[r][c] = v; });
    if (res.moved) moved = true;
    gain += res.gain;
    res.merged.forEach(t => anim.merged.add(coords[t][0] * TF_N + coords[t][1]));
    res.moves.forEach(m => anim.moves.push({ from: coords[m.from], to: coords[m.to], v: m.v }));
  }
  if (!moved) return;
  if (!tfCounted) { tfCounted = true; Stats.played('2048', 'all'); }
  tfScore += gain;
  if (tfScore > tfBest) tfBest = tfScore;
  tfAdd();
  tfRender(anim);
  if (gain) { Sfx.play('merge'); tfShowGain(gain); } else Sfx.play('tick');
  const banner = document.getElementById('tfBanner');
  if (!tfKeep && tfBoard.flat().includes(2048)) {
    tfPaused = true;
    banner.className = 'banner win';
    banner.innerHTML = 'Bravo, tu as atteint 2048 ! <button class="btn" id="tfContinue">Continuer</button><button class="btn" id="tfSave">Enregistrer mon score</button>';
    document.getElementById('tfSave').onclick = () => { document.activeElement.blur(); scSubmit('2048', 'all', tfScore); };
    Sfx.play('win'); Fx.confetti();
    document.getElementById('tfContinue').onclick = () => {
      tfKeep = true; tfPaused = false; banner.className = 'banner'; banner.textContent = '';
      document.activeElement.blur();
    };
  } else if (!tfCanMove()) {
    tfOver = true;
    banner.className = 'banner lose';
    banner.textContent = 'Plus de mouvement possible. Score : ' + tfScore;
    Sfx.play('lose');
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

const TF_PITCH = 24.375;   // pas d'une case en cqw (case 21.875 + espace 2.5)

function tfTileEl(v, r, c) {
  const d = document.createElement('div');
  d.className = 'tf-tile ' + (v <= 2048 ? 'tf-' + v : 'tf-big');
  d.textContent = v;
  d.style.left = (2.5 + c * TF_PITCH) + 'cqw';
  d.style.top  = (2.5 + r * TF_PITCH) + 'cqw';
  return d;
}

// anim (facultatif) : trajets des tuiles du dernier coup, pour les animer
function tfRender(anim) {
  const g = document.getElementById('tfBoard');
  g.innerHTML = '';
  for (let i = 0; i < TF_N * TF_N; i++) { const bg = document.createElement('div'); bg.className = 'tf-cell'; g.appendChild(bg); }
  const els = {};
  tfBoard.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return;
    els[r * TF_N + c] = tfTileEl(v, r, c);
    g.appendChild(els[r * TF_N + c]);
  }));
  if (anim && motionOK()) {
    anim.moves.forEach(m => {
      const dx = (m.from[1] - m.to[1]) * TF_PITCH, dy = (m.from[0] - m.to[0]) * TF_PITCH;
      if (!dx && !dy) return;
      const idx = m.to[0] * TF_N + m.to[1];
      let el = els[idx];
      if (anim.merged.has(idx)) {            // fusion : la tuile qui arrive est une « fantôme » qui glisse puis disparaît
        el = tfTileEl(m.v, m.to[0], m.to[1]);
        g.appendChild(el);
        el.animate([{ transform: `translate(${dx}cqw, ${dy}cqw)` }, { transform: 'translate(0, 0)' }], { duration: 110, easing: 'ease-out' })
          .onfinish = () => el.remove();
        return;
      }
      el.animate([{ transform: `translate(${dx}cqw, ${dy}cqw)` }, { transform: 'translate(0, 0)' }], { duration: 110, easing: 'ease-out' });
    });
    anim.merged.forEach(idx => {             // la tuile fusionnée apparaît une fois les deux arrivées, avec un « pop »
      els[idx].animate([{ opacity: 0, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.18)', offset: 0.5 }, { opacity: 1, transform: 'scale(1)' }],
                       { duration: 170, delay: 100, fill: 'backwards' });
    });
    if (tfNew >= 0 && els[tfNew]) {
      els[tfNew].animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }],
                         { duration: 150, delay: 100, fill: 'backwards' });
    }
  }
  document.getElementById('tfScore').textContent = tfScore;
  document.getElementById('tfBest').textContent = tfBest;
}

// « +N » qui s'envole depuis le score
function tfShowGain(n) {
  const el = document.getElementById('tfGain');
  if (!el || !motionOK()) return;
  el.textContent = '+' + n;
  el.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-22px)' }], { duration: 700, easing: 'ease-out' });
}


GAMES['2048'] = {
  start(saved) { document.addEventListener('keydown', tfKeyHandler); initTf(saved); },
  stop()  { document.removeEventListener('keydown', tfKeyHandler); },
  inProgress() { return !tfOver && tfScore > 0; },
  save() {
    if (!GAMES['2048'].inProgress()) return null;
    return { board: tfBoard, score: tfScore, keep: tfKeep || tfBoard.flat().includes(2048) };   // 2048 déjà atteint : on reprend en mode « continuer »
  }
};
