/* ════════════════════════════════════════════
   NOYAU : registre des jeux et navigation
   Chaque jeu (js/games/*.js) s'enregistre dans GAMES avec :
     start() : appelé quand le jeu s'affiche (le template est déjà inséré dans #game-content)
     stop()  : appelé quand on quitte le jeu (arrêter minuteurs et écouteurs clavier)
     wide    : (optionnel) true si le jeu a besoin d'une zone plus large
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
  GAMES[id].start();
}

function stopGame() {
  if (activeGame) { GAMES[activeGame].stop(); activeGame = null; }
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
}
