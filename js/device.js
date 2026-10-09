/* ════════════════════════════════════════════
   DÉTECTION DE L'APPAREIL : ordinateur (souris + clavier) ou mobile (tactile)
   Le résultat est écrit dans <html data-device="mobile|desktop"> ; le CSS et les jeux s'y adaptent
   (commandes tactiles, tailles des zones à toucher, textes d'aide). Le réglage ⚙ « Affichage » permet de le forcer.
════════════════════════════════════════════ */
const Device = {
  // Détection automatique : l'appareil est « mobile » si son pointeur principal est tactile
  // (téléphone, tablette) ou si le navigateur se déclare mobile. Un portable à écran tactile reste un ordinateur,
  // puisque son pointeur principal est la souris ou le pavé tactile.
  detect() {
    const mq = q => !!(window.matchMedia && matchMedia(q).matches);
    const ua = (navigator.userAgent || '');
    const touchFirst = mq('(pointer: coarse)') && mq('(hover: none)');
    const uaData = navigator.userAgentData;
    const uaMobile = uaData && typeof uaData.mobile === 'boolean' ? uaData.mobile : /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua);
    const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1;   // l'iPad se présente comme un Mac
    return touchFirst || uaMobile || iPadOS ? 'mobile' : 'desktop';
  },

  // Mode effectivement utilisé : le réglage manuel s'il existe, sinon la détection
  mode() {
    const forced = Settings.get('device');
    return forced === 'mobile' || forced === 'desktop' ? forced : this.detect();
  },

  isMobile() { return this.mode() === 'mobile'; },

  apply() {
    const root = document.documentElement, mode = this.mode();
    if (root.getAttribute('data-device') !== mode) {
      root.setAttribute('data-device', mode);
      window.dispatchEvent(new Event('devicechange'));
    }
  }
};

// L'appareil peut changer en cours de route (tablette + clavier, souris branchée…)
['(pointer: coarse)', '(hover: none)'].forEach(q => {
  const m = window.matchMedia && matchMedia(q);
  if (m && m.addEventListener) m.addEventListener('change', () => Device.apply());
});

Device.apply();
