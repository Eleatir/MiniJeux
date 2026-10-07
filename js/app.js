/* ════════════════════════════════════════════
   DÉMARRAGE : état initial du menu et message d'accueil
════════════════════════════════════════════ */
menuRefresh();

function welcomeShow() {
  const ui = scOpen({});
  ui.panel.innerHTML =
    '<p class="sc-kicker">★ BIENVENUE ★</p>' +
    '<p class="sc-sub" style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#e8e6df">' +
    'Cinq mini-jeux, sans compte ni installation.<br>' +
    '🏆 Tes scores sont gardés sur cet ordinateur : signe-les de 3 lettres, comme à l\'arcade.<br>' +
    '▶ Les parties en cours sont reprises là où tu les as laissées.<br>' +
    '⎋ <strong>Échap</strong> revient au menu · ⚙ pour les sons et le contraste.</p>' +
    '<div class="sc-actions"><button class="btn sc-ok" data-a="ok">C\'est parti !</button></div>';
  ui.key = e => { if (e.key === 'Enter' || e.key === 'Escape') scClose(); };
  ui.el.addEventListener('click', e => { if (e.target === ui.el || e.target.closest('[data-a]')) scClose(); });
}

try {
  if (!localStorage.getItem('minijeux.welcomed')) {
    localStorage.setItem('minijeux.welcomed', '1');
    welcomeShow();
  }
} catch (e) {}
