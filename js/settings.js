/* ════════════════════════════════════════════
   RÉGLAGES (sons, contraste élevé, animations) + effets sonores
   Les réglages sont gardés dans localStorage ; les sons sont désactivés par défaut.
════════════════════════════════════════════ */
const SET_KEY = 'minijeux.settings.v1';
const SET_DEFAULTS = { sound: false, contrast: false, motion: true };
const SET_LABELS = {
  sound:    ['🔊 Effets sonores', 'Petits bips pendant le jeu'],
  contrast: ['🎨 Contraste élevé', 'Couleurs adaptées au daltonisme (Wordle : orange et bleu)'],
  motion:   ['✨ Animations', 'Glissements, retournements, confettis']
};

const Settings = {
  data: null,
  load() {
    if (this.data) return this.data;
    this.data = Object.assign({}, SET_DEFAULTS);
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(SET_KEY)) || {}); } catch (e) {}
    return this.data;
  },
  get(k) { return this.load()[k]; },
  set(k, v) {
    this.load()[k] = v;
    try { localStorage.setItem(SET_KEY, JSON.stringify(this.data)); } catch (e) {}
    this.apply();
  },
  apply() {
    document.documentElement.classList.toggle('hc', !!this.get('contrast'));
    document.documentElement.classList.toggle('no-motion', !motionOK());
  }
};

// Vrai si les animations sont autorisées (réglage du jeu ET préférence du système)
function motionOK() {
  const sys = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !sys && Settings.get('motion') !== false;
}

/* ── effets sonores (Web Audio, aucune ressource externe) ── */
const Sfx = {
  ctx: null,
  PATTERNS: {
    click: [[660, 0.04]],
    tick:  [[440, 0.05]],
    good:  [[660, 0.06], [880, 0.08]],
    bad:   [[180, 0.15, 'sawtooth']],
    eat:   [[880, 0.04], [1175, 0.05]],
    place: [[400, 0.04]],
    merge: [[520, 0.05], [780, 0.06]],
    flip:  [[500, 0.03]],
    boom:  [[120, 0.35, 'sawtooth']],
    win:   [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.28]],
    lose:  [[300, 0.15], [220, 0.15], [160, 0.3, 'sawtooth']]
  },
  play(name) {
    if (!Settings.get('sound')) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      this.ctx = this.ctx || new A();
      let t = this.ctx.currentTime;
      (this.PATTERNS[name] || []).forEach(([freq, dur, type]) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.04, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
        t += dur * 0.9;
      });
    } catch (e) {}
  }
};

/* ── fenêtre des réglages (même habillage que les scores) ── */
function setShow() {
  const keys = Object.keys(SET_LABELS);
  let sel = 0;
  const ui = scOpen({});
  const render = () => {
    ui.panel.innerHTML =
      '<p class="sc-kicker">⚙ RÉGLAGES</p><div class="set-list">' +
      keys.map((k, i) =>
        '<button class="set-row' + (i === sel ? ' sel' : '') + '" data-k="' + k + '" role="switch" aria-checked="' + !!Settings.get(k) + '">' +
        '<span><strong>' + SET_LABELS[k][0] + '</strong><small>' + SET_LABELS[k][1] + '</small></span>' +
        '<span class="set-sw' + (Settings.get(k) ? ' on' : '') + '">' + (Settings.get(k) ? 'OUI' : 'NON') + '</span></button>').join('') +
      '</div><p class="sc-hint">↑ ↓ choisir · Espace pour changer · Échap pour fermer</p>' +
      '<div class="sc-actions"><button class="btn sc-ok" data-a="close">Fermer</button></div>';
  };
  const toggle = k => { Settings.set(k, !Settings.get(k)); if (k === 'sound') Sfx.play('good'); render(); };
  ui.key = e => {
    if (e.key === 'Escape') { scClose(); return; }
    if (e.key === 'ArrowUp') sel = (sel + keys.length - 1) % keys.length;
    else if (e.key === 'ArrowDown') sel = (sel + 1) % keys.length;
    else if (e.key === ' ' || e.key === 'Enter') toggle(keys[sel]);
    else return;
    render();
  };
  ui.el.addEventListener('click', e => {
    if (e.target === ui.el) { scClose(); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.a === 'close') { scClose(); return; }
    if (b.dataset.k) { sel = keys.indexOf(b.dataset.k); toggle(b.dataset.k); }
  });
  render();
}

Settings.apply();
