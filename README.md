# Mini-jeux

Six petits jeux jouables dans le navigateur, sans installation ni dépendance : Wordle, Démineur, Snake, Sudoku, Mots fléchés et Solitaire.

## Ce que ça fait

- **Scores d'arcade** : top 10 par jeu et par niveau, nom en 3 lettres, tableau consultable depuis le menu ; export / import en fichier JSON.
- **Reprise de partie** : Wordle, Démineur, Sudoku, Mots fléchés et Solitaire reprennent là où on les a laissés (Échap ou « Retour au menu » sauvegarde la partie). Le Snake demande confirmation avant de quitter.
- **Confort** : Échap revient au menu, confirmation avant d'abandonner une partie, règles dépliables dans chaque jeu (ouvertes la première fois), pause automatique du Snake, Ctrl+Z et N au Solitaire.
- **Réglages** (⚙) : effets sonores (désactivés par défaut), contraste élevé pour le daltonisme, animations activables/désactivables (la préférence « réduire les animations » du système est respectée).
- **Ordinateur ou mobile** : l'appareil est détecté automatiquement (pointeur tactile ou navigateur mobile). Sur mobile : commandes tactiles dans chaque jeu (manette et glissement au Snake, appui long ou bouton 🚩 au Démineur, pavé numérique au Sudoku, clavier de lettres aux Mots fléchés, glisser-déposer et double-tap au Solitaire), grandes zones à toucher, mise en page qui tient sur 320 px. Le réglage ⚙ « Affichage » permet de forcer l'un ou l'autre.
- **Mots fléchés** : grilles inventées à chaque partie (3 tailles) à partir de ~800 mots avec définitions (`js/games/mots-words.js`, une ligne `MOT|définition` par mot : facile à enrichir). Aides payantes en secondes : ✔ vérifier +20 s, 💡 lettre +15 s, 💡 mot +45 s.
- **Pause** (⏸ ou Espace/P) dans tous les jeux : les chronos sont gelés et la grille masquée ; les fenêtres (scores, réglages) mettent la partie en pause toutes seules. Sur mobile, tout tient dans l'écran, sans défilement.
- **Scores « Moi » et « Tous »** : le tableau montre ses propres scores (sur l'appareil) ou le classement général de tous les joueurs (voir ci-dessous).
- Les parties et les scores personnels sont gardés dans le navigateur (`localStorage`). Le classement général est facultatif : sans lui, rien n'est envoyé nulle part.

## Classement général (facultatif)

**Aucun compte joueur n'est nécessaire.** Chacun garde ses 3 lettres d'arcade ; l'appareil est reconnu par un identifiant aléatoire (jamais affiché) pour mettre ses propres scores en évidence. Seul le propriétaire du site a besoin d'un compte Google (gratuit) pour héberger le classement :

1. Crée une feuille Google Sheets vide, puis **Extensions → Apps Script**.
2. Colle le contenu de `server/apps-script.gs`, enregistre.
3. **Déployer → Nouveau déploiement → Application Web** : exécuter en tant que *moi*, accès *tout le monde*. Autorise, puis copie l'adresse terminée par `/exec`.
4. Colle-la dans `js/config.js` (`LEADERBOARD_URL`), commit, push.

Limite assumée : sans compte, n'importe qui connaissant l'adresse peut envoyer un score avec n'importe quelles initiales. C'est suffisant entre quelques personnes de confiance ; le service refuse déjà les valeurs absurdes. Les scores d'un joueur hors connexion sont renvoyés plus tard.

Quand `server/apps-script.gs` change (par exemple pour un nouveau jeu), colle la nouvelle version dans Apps Script puis **Déployer → Gérer les déploiements → Modifier → Nouvelle version** : l'adresse reste la même.

## Lancer

Ouvrir `index.html` dans un navigateur (ou servir le dossier avec n'importe quel serveur statique, par exemple GitHub Pages).

## Tests

```sh
npm install                       # une seule fois (installe Playwright)
npx playwright install chromium   # une seule fois (télécharge le navigateur de test)

npm run test:unit                 # logique pure, instantané, sans navigateur
npm run test:e2e                  # un vrai Chromium joue aux six jeux (ordinateur, puis téléphone émulé)
npm test                          # les deux
```

- `tests/unit/` : tests Node (`node --test`, sans aucune dépendance). Les scripts du jeu sont chargés dans un contexte isolé avec un faux navigateur (`helpers.js`) : générateur et solveur du Sudoku (solution unique), générateur de grilles de mots fléchés et intégrité de leur lexique, règles du Démineur et du Solitaire, calcul des couleurs du Wordle, intégrité des listes de mots et du dictionnaire, scores, import/export, sauvegardes.
- `tests/e2e/` : tests Playwright qui jouent réellement dans Chromium (clavier, souris, glisser-déposer, reprise de partie, scores, réglages). Deux projets : **desktop** (tous les tests) et **mobile** (fichiers `*.mobile.spec.js`, téléphone Pixel 7 émulé : détection de l'appareil, gestes tactiles, mise en page). Chaque test part d'un navigateur vierge et échoue à la moindre erreur dans la console.
- `PW_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e` pour utiliser un Chromium déjà installé.
- `npm start` sert le jeu sur http://localhost:4173.
- La CI (`.github/workflows/tests.yml`) lance les deux séries à chaque pull request et à chaque push sur `main`.

## Structure

```
index.html            page, menu et templates HTML de chaque jeu
css/style.css         styles de toute l'application
js/scores.js          tableaux de scores (Moi / Tous), saisie du nom, export/import
js/config.js          adresse du classement général
js/online.js          client du classement général (envoi, file d'attente, cache)
server/apps-script.gs service du classement (Google Apps Script)
js/settings.js        réglages et effets sonores
js/device.js          détection ordinateur / mobile
js/fx.js              effets visuels partagés (confettis)
js/storage.js         parties sauvegardées et statistiques du menu
js/core.js            registre des jeux (GAMES), navigation, confirmations
js/app.js             démarrage (menu, message d'accueil)
js/games/             un fichier par jeu
  wordle-words.js     mots à deviner (liste choisie)
  wordle-dict.js      dictionnaire de validation des essais
tests/unit/           tests de la logique (Node)
tests/e2e/            tests de bout en bout (Playwright)
tests/serve.js        serveur statique sans dépendance (npm start et tests)
.github/workflows/    intégration continue
```

## Ajouter un jeu

1. Ajouter une carte dans le menu de `index.html` (`data-game="monjeu"` et `onclick="startGame('monjeu')"`, avec les éléments `data-badge` et `data-meta`) et un `<template id="tpl-monjeu">`.
2. Créer `js/games/monjeu.js` et l'enregistrer :
   ```js
   GAMES.monjeu = {
     start(saved) { /* initialiser (saved = partie à reprendre, si save() existe) */ },
     stop()  { /* arrêter minuteurs et écouteurs */ },
     inProgress() { /* optionnel : une partie est-elle en cours ? */ },
     save()  { /* optionnel : état à reprendre plus tard, ou null */ }
   };
   ```
3. Déclarer le jeu dans `SC_GAMES` / `SC_ORDER` (`js/scores.js`) pour avoir un tableau de scores, puis appeler `scSubmit(jeu, mode, valeur)` à la fin d'une partie et `Stats.played(jeu, mode)` au premier coup.
4. Ajouter la balise `<script>` correspondante en bas de `index.html`.

## Crédits

Le dictionnaire du Wordle provient du paquet npm [`an-array-of-french-words`](https://www.npmjs.com/package/an-array-of-french-words) (licence MIT, voir `licenses/`).
