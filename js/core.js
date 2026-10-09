/* ════════════════════════════════════════════
   NOYAU : registre des jeux et navigation
   Chaque jeu (js/games/*.js) s'enregistre dans GAMES avec :
     start(saved) : appelé quand le jeu s'affiche (le template est déjà inséré dans #game-content) ;
                    saved = partie sauvegardée à reprendre (seulement si le jeu définit save)
     stop()       : appelé quand on quitte le jeu (arrêter minuteurs et écouteurs clavier)
     wide         : (optionnel) true si le jeu a besoin d'une zone plus large
     inProgress() : (optionnel) true si une partie est en cours (sert aux confirmations)
     save()       : (optionnel) état à sauvegarder pour reprendre plus tard, ou null s'il n'y a rien à reprendre
     canPause()   : (optionnel) true si le jeu peut être mis en pause maintenant (faux une fois la partie terminée)
     pause()      : (optionnel) geler minuteurs et animations ; appelé par le bouton ⏸ et quand une fenêtre s'ouvre par-dessus
     resume()     : (optionnel) reprendre après une pause
════════════════════════════════════════════ */
const GAMES = {};
let currentGame = 'wordle', activeGame = null;
let paused = false, pausedByModal = false;   // pausedByModal : la pause vient d'une fenêtre ouverte (elle se lève à sa fermeture)

// ── Pause commune à tous les jeux : bouton ⏸ de la barre, voile « Reprendre » qui cache la grille, chronos gelés ──
function pauseGame() {
  const g = activeGame && GAMES[activeGame];
  if (!g || paused || (g.canPause && !g.canPause())) return false;
  paused = true;
  if (g.pause) g.pause();
  const over = document.createElement('div');
  over.id = 'pauseOverlay'; over.className = 'pause-overlay';
  over.innerHTML = '<p>⏸ Pause</p><button class="btn sc-ok" type="button">▶ Reprendre</button>';
  over.onclick = () => resumeGame();
  document.getElementById('game-content').appendChild(over);
  pauseUI();
  return true;
}

function resumeGame() {
  if (!paused) return;
  paused = false; pausedByModal = false;
  const g = activeGame && GAMES[activeGame];
  if (g && g.resume) g.resume();
  const over = document.getElementById('pauseOverlay');
  if (over) over.remove();
  pauseUI();
}

function togglePause() { if (paused) resumeGame(); else pauseGame(); }

function pauseUI() {
  const b = document.getElementById('pauseBtn');
  if (!b) return;
  b.textContent = paused ? '▶' : '⏸';
  b.setAttribute('aria-pressed', paused);
  b.setAttribute('aria-label', paused ? 'Reprendre' : 'Pause');
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
}

// En pause, le clavier ne joue plus : Entrée, Espace ou P reprennent, Échap quitte vers le menu
window.addEventListener('keydown', e => {
  if (!paused || scUI || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab' || e.key === 'Escape') return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'p' || e.key === 'P') resumeGame();
}, true);

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
  pauseUI();
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
  paused = pausedByModal = false;
  const over = document.getElementById('pauseOverlay');
  if (over) over.remove();
  pauseUI();
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
