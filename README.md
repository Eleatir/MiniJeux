# Mini-jeux

Cinq petits jeux jouables dans le navigateur, sans installation ni dépendance : Wordle, Démineur, Snake, Sudoku et Solitaire.

## Ce que ça fait

- **Scores d'arcade** : top 10 par jeu et par niveau, nom en 3 lettres, tableau consultable depuis le menu ; export / import en fichier JSON.
- **Reprise de partie** : Wordle, Démineur, Sudoku et Solitaire reprennent là où on les a laissés (Échap ou « Retour au menu » sauvegarde la partie). Le Snake demande confirmation avant de quitter.
- **Confort** : Échap revient au menu, confirmation avant d'abandonner une partie, règles dépliables dans chaque jeu (ouvertes la première fois), pause automatique du Snake, Ctrl+Z et N au Solitaire.
- **Réglages** (⚙) : effets sonores (désactivés par défaut), contraste élevé pour le daltonisme, animations activables/désactivables (la préférence « réduire les animations » du système est respectée).
- Tout est gardé dans le navigateur (`localStorage`), rien n'est envoyé nulle part.

## Lancer

Ouvrir `index.html` dans un navigateur (ou servir le dossier avec n'importe quel serveur statique, par exemple GitHub Pages).

## Tests

```sh
npm install                       # une seule fois (installe Playwright)
npx playwright install chromium   # une seule fois (télécharge le navigateur de test)

npm run test:unit                 # logique pure, instantané, sans navigateur
npm run test:e2e                  # un vrai Chromium joue aux cinq jeux
npm test                          # les deux
```

- `tests/unit/` : tests Node (`node --test`, sans aucune dépendance). Les scripts du jeu sont chargés dans un contexte isolé avec un faux navigateur (`helpers.js`) : générateur et solveur du Sudoku (solution unique), règles du Démineur et du Solitaire, calcul des couleurs du Wordle, intégrité des listes de mots et du dictionnaire, scores, import/export, sauvegardes.
- `tests/e2e/` : tests Playwright qui jouent réellement dans Chromium (clavier, souris, glisser-déposer, reprise de partie, scores, réglages). Chaque test part d'un navigateur vierge et échoue à la moindre erreur dans la console.
- `PW_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e` pour utiliser un Chromium déjà installé.
- `npm start` sert le jeu sur http://localhost:4173.
- La CI (`.github/workflows/tests.yml`) lance les deux séries à chaque pull request et à chaque push sur `main`.

## Structure

```
index.html            page, menu et templates HTML de chaque jeu
css/style.css         styles de toute l'application
js/scores.js          tableaux de scores, saisie du nom, export/import
js/settings.js        réglages et effets sonores
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
