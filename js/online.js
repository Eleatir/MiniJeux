/* ════════════════════════════════════════════
   CLASSEMENT GÉNÉRAL (tous les joueurs)
   Les scores sont aussi envoyés à un petit service (voir server/apps-script.gs) dont l'adresse est dans js/config.js.
   Aucun compte : un joueur est reconnu par un identifiant aléatoire gardé sur son appareil (jamais affiché),
   et signe ses scores de 3 lettres, comme à l'arcade. Tout est facultatif : sans adresse configurée, ou hors connexion,
   le jeu fonctionne exactement comme avant.
════════════════════════════════════════════ */
const OL_PID_KEY = 'minijeux.pid', OL_OUTBOX_KEY = 'minijeux.outbox', OL_OUTBOX_MAX = 50;

const Online = {
  CACHE_MS: 30000,     // un tableau déjà chargé est réutilisé pendant 30 s
  TIMEOUT_MS: 8000,
  cache: {},

  url() { return (typeof LEADERBOARD_URL === 'string' ? LEADERBOARD_URL : '').trim(); },
  enabled() { return !!this.url(); },

  // Identifiant anonyme de cet appareil (sert à repérer « mes » scores dans le classement général)
  playerId() {
    let id = null;
    try { id = localStorage.getItem(OL_PID_KEY); } catch (e) {}
    if (!/^[a-z0-9]{12,32}$/.test(id || '')) {
      id = '';
      while (id.length < 16) id += Math.floor(Math.random() * 36).toString(36);
      try { localStorage.setItem(OL_PID_KEY, id); } catch (e) {}
    }
    return id;
  },

  async _call(url, opts) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), this.TIMEOUT_MS);
    try {
      const r = await fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  },

  // Les 10 meilleurs d'un tableau. Renvoie { disabled } si le service n'est pas configuré, { error, entries } s'il est injoignable.
  async top(game, mode, force) {
    if (!this.enabled()) return { disabled: true, entries: [] };
    const key = game + '|' + mode, hit = this.cache[key];
    if (!force && hit && Date.now() - hit.t < this.CACHE_MS) return hit.data;
    try {
      const sep = this.url().includes('?') ? '&' : '?';
      const data = await this._call(this.url() + sep + 'action=top&game=' + encodeURIComponent(game) + '&mode=' + encodeURIComponent(mode) + '&pid=' + this.playerId());
      if (!data || !data.ok || !Array.isArray(data.entries)) throw new Error('réponse invalide');
      const out = { entries: data.entries.map(e => Object.assign(scClean(e), { mine: !!e.mine })).slice(0, SC_MAX) };
      this.cache[key] = { t: Date.now(), data: out };
      return out;
    } catch (e) {
      return { error: true, entries: hit ? hit.data.entries : [] };
    }
  },

  // Envoie un score. Si le réseau est coupé, il est gardé et renvoyé plus tard (flush). Un refus du service est définitif.
  async submit(game, mode, v, name, d) {
    if (!this.enabled()) return { disabled: true };
    const payload = { action: 'submit', game, mode: String(mode), v, n: name, d, pid: this.playerId() };
    try {
      const r = await this._post(payload);
      delete this.cache[game + '|' + mode];
      return r;
    } catch (e) {
      this._queue(payload);
      return { queued: true };
    }
  },

  // true : accepté ou refusé définitivement par le service ; lève une erreur si le réseau a échoué (on réessaiera)
  async _post(payload) {
    const r = await this._call(this.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    if (!r || typeof r.ok !== 'boolean') throw new Error('réponse invalide');
    return r;
  },

  _outbox() { try { const a = JSON.parse(localStorage.getItem(OL_OUTBOX_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  _saveOutbox(a) { try { localStorage.setItem(OL_OUTBOX_KEY, JSON.stringify(a.slice(-OL_OUTBOX_MAX))); } catch (e) {} },
  _queue(payload) { this._saveOutbox(this._outbox().concat([payload])); },

  // Renvoie les scores restés en attente (au démarrage, ou après un envoi réussi)
  async flush() {
    if (!this.enabled()) return 0;
    const pending = this._outbox();
    let sent = 0;
    for (let i = 0; i < pending.length; i++) {
      try { await this._post(pending[i]); sent++; }
      catch (e) { this._saveOutbox(pending.slice(i)); return sent; }     // réseau coupé : on garde le reste
    }
    this._saveOutbox([]);
    return sent;
  }
};
