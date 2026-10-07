/* ════════════════════════════════════════════
   NOYAU : registre des jeux et navigation
   Chaque jeu (js/games/*.js) s'enregistre dans GAMES avec :
     start(saved) : appelé quand le jeu s'affiche (le template est déjà inséré dans #game-content) ;
                    saved = partie sauvegardée à reprendre (seulement si le jeu définit save)
     stop()       : appelé quand on quitte le jeu (arrêter minuteurs et écouteurs clavier)
     wide         : (optionnel) true si le jeu a besoin d'une zone plus large
     inProgress() : (optionnel) true si une partie est en cours (sert aux confirmations)
     save()       : (optionnel) état à sauvegarder pour reprendre plus tard, ou null s'il n'y a rien à reprendre
     pause()      : (optionnel) mettre le jeu en pause (appelé quand une fenêtre s'ouvre par-dessus)
════════════════════════════════════════════ */
const GAMES = {};
let currentGame = 'wordle', activeGame = null;

function startGame(id) {
  stopGame();
  currentGame = activeGame = id;
  document.getElementById('menu').style.display = 'none';
  const shell = document.getElementById('game-shell');
  shell.style.display = 'block';
  shell.classList.toggle('wide', !!GAMES[id].wide);
  const content = document.getElementById('game-content');
  content.innerHTML = '';
  content.appendChild(document.getElementById('tpl-' + id).content.cloneNode(true));
  document.title = 'Mini-jeux — ' + SC_GAMES[id].label;
  // les règles s'ouvrent seules la première fois qu'on lance un jeu
  const rules = content.querySelector('details.rules');
  if (rules) {
    let seen = false;
    try { seen = !!localStorage.getItem('minijeux.rules.' + id); localStorage.setItem('minijeux.rules.' + id, '1'); } catch (e) {}
    rules.open = !seen;
  }
  const saved = GAMES[id].save ? Save.load(id) : null;
  GAMES[id].start(saved);
  if (saved) scToast('Partie reprise');
}

// Sauvegarde la partie en cours du jeu actif (ou efface la sauvegarde si elle est terminée)
function persistActive() {
  const g = activeGame && GAMES[activeGame];
  if (g && g.save) Save.store(activeGame, g.save());
}

function stopGame() {
  if (activeGame) { persistActive(); GAMES[activeGame].stop(); activeGame = null; }
}

// Fenêtre de confirmation (même habillage que les scores). Entrée = confirmer, Échap = annuler.
function askConfirm(title, text, okLabel, onYes) {
  const ui = scOpen({});
  ui.panel.innerHTML =
    '<p class="sc-kicker">' + title + '</p><p class="sc-sub" style="margin:14px 0 4px;font-size:14px;color:#e8e6df">' + text + '</p>' +
    '<div class="sc-actions"><button class="btn" data-a="no">Annuler</button><button class="btn sc-ok" data-a="yes">' + okLabel + '</button></div>';
  ui.key = e => {
    if (e.key === 'Enter') { scClose(); onYes(); }
    else if (e.key === 'Escape') scClose();
  };
  ui.el.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (e.target === ui.el || (b && b.dataset.a === 'no')) scClose();
    else if (b && b.dataset.a === 'yes') { scClose(); onYes(); }
  });
}

// Retour au menu : les jeux qui se sauvegardent reprennent plus tard, les autres demandent confirmation
function leaveGame() {
  const g = activeGame && GAMES[activeGame];
  if (g && !g.save && g.inProgress && g.inProgress()) askConfirm('QUITTER LE JEU ?', 'La partie en cours sera perdue.', 'Quitter', goMenu);
  else goMenu();
}

// Changement de niveau pendant une partie : demande confirmation et remet l'ancienne valeur du menu si on annule
function confirmChange(sel, oldValue, fn, okLabel) {
  const want = sel.value, g = activeGame && GAMES[activeGame];
  if (!(g && g.inProgress && g.inProgress())) { fn(); return; }
  sel.value = oldValue;
  askConfirm('ABANDONNER LA PARTIE ?', 'La partie en cours sera perdue.', okLabel || 'Changer', () => { sel.value = want; fn(); });
}

// Exécute fn tout de suite, ou après confirmation si une partie est en cours dans le jeu actif
function confirmAbandon(fn, okLabel) {
  const g = activeGame && GAMES[activeGame];
  if (g && g.inProgress && g.inProgress()) askConfirm('ABANDONNER LA PARTIE ?', 'La partie en cours sera perdue.', okLabel || 'Abandonner', fn);
  else fn();
}

function goMenu() {
  scClose();
  stopGame();
  document.getElementById('game-shell').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.title = 'Mini-jeux';
  menuRefresh();
}

// Cartes du menu : badge « partie en cours », nombre de parties et record du dernier niveau joué
function menuRefresh() {
  document.querySelectorAll('.card[data-game]').forEach(card => {
    const id = card.dataset.game, cfg = SC_GAMES[id];
    const badge = card.querySelector('[data-badge]'), meta = card.querySelector('[data-meta]');
    const resumable = !!GAMES[id].save && Save.has(id);
    badge.style.display = resumable ? '' : 'none';
    const n = Stats.count(id), mode = Stats.mode(id);
    let txt = n ? n + (n > 1 ? ' parties' : ' partie') : 'Pas encore joué';
    const best = n && cfg.modes[mode] !== undefined ? scBest(id, mode) : null;
    if (best !== null) txt += ' · 🏆 ' + cfg.modes[mode] + ' : ' + cfg.fmt(best);
    meta.textContent = txt;
  });
}

// Échap : retour au menu depuis un jeu (quand aucune fenêtre n'est ouverte)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeGame && !scUI && !e.ctrlKey && !e.metaKey && !e.altKey) leaveGame();
});
// Sauvegarde quand on ferme ou quitte la page
window.addEventListener('pagehide', persistActive);
document.addEventListener('visibilitychange', () => { if (document.hidden) persistActive(); });
