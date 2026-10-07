/* ════════════════════════════════════════════
   STOCKAGE LOCAL : parties en cours (reprise) et statistiques du menu
   Tout est gardé dans localStorage ; chaque accès est protégé (navigation privée, stockage bloqué…).
════════════════════════════════════════════ */
const Save = {
  key(id) { return 'minijeux.save.' + id + '.v1'; },
  load(id) { try { return JSON.parse(localStorage.getItem(this.key(id))); } catch (e) { return null; } },
  // state = null efface la sauvegarde
  store(id, state) {
    try {
      if (state) localStorage.setItem(this.key(id), JSON.stringify(state));
      else localStorage.removeItem(this.key(id));
    } catch (e) {}
  },
  has(id) { return !!this.load(id); }
};

const Stats = {
  KEY: 'minijeux.stats.v1',
  data: null,
  load() {
    if (this.data) return this.data;
    this.data = { played: {}, mode: {} };
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d && d.played && d.mode) this.data = d;
    } catch (e) {}
    return this.data;
  },
  // une partie vient réellement de commencer (premier coup joué)
  played(game, mode) {
    const d = this.load();
    d.played[game] = (d.played[game] || 0) + 1;
    d.mode[game] = String(mode);
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {}
  },
  count(game) { return this.load().played[game] || 0; },
  mode(game) { return this.load().mode[game]; }
};
