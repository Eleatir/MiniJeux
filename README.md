# Mini-jeux

Cinq petits jeux jouables dans le navigateur, sans installation ni dépendance : Wordle, Démineur, Snake, 2048 et Solitaire.

## Ce que ça fait

- **Scores d'arcade** : top 10 par jeu et par niveau, nom en 3 lettres, tableau consultable depuis le menu ; export / import en fichier JSON.
- **Reprise de partie** : Wordle, Démineur, 2048 et Solitaire reprennent là où on les a laissés (Échap ou « Retour au menu » sauvegarde la partie). Le Snake demande confirmation avant de quitter.
- **Confort** : Échap revient au menu, confirmation avant d'abandonner une partie, règles dépliables dans chaque jeu (ouvertes la première fois), pause automatique du Snake, Ctrl+Z et N au Solitaire.
- **Réglages** (⚙) : effets sonores (désactivés par défaut), contraste élevé pour le daltonisme, animations activables/désactivables (la préférence « réduire les animations » du système est respectée).
- Tout est gardé dans le navigateur (`localStorage`), rien n'est envoyé nulle part.

## Lancer

Ouvrir `index.html` dans un navigateur (ou servir le dossier avec n'importe quel serveur statique, par exemple GitHub Pages).

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
