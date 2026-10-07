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

function goMenu() {
  scClose();
  stopGame();
  document.getElementById('game-shell').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
}
