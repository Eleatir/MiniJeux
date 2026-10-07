# Mini-jeux

Cinq petits jeux jouables dans le navigateur, sans installation ni dépendance : Wordle, Démineur, Snake, 2048 et Solitaire.
Les meilleurs scores sont gardés dans le navigateur (`localStorage`), avec saisie du nom en 3 lettres façon borne d'arcade.

## Lancer

Ouvrir `index.html` dans un navigateur (ou servir le dossier avec n'importe quel serveur statique, par exemple GitHub Pages).

## Structure

```
index.html            page, menu et templates HTML de chaque jeu
css/style.css         styles de toute l'application
js/scores.js          tableaux de scores et saisie du nom
js/core.js            registre des jeux (GAMES) et navigation
js/games/             un fichier par jeu (+ wordle-words.js : listes de mots)
```

## Ajouter un jeu

1. Ajouter une carte dans le menu de `index.html` (`onclick="startGame('monjeu')"`) et un `<template id="tpl-monjeu">`.
2. Créer `js/games/monjeu.js` et l'enregistrer :
   ```js
   GAMES.monjeu = {
     start() { /* initialiser le jeu, brancher le clavier */ },
     stop()  { /* arrêter minuteurs et écouteurs */ }
   };
   ```
3. Déclarer le jeu dans `SC_GAMES` / `SC_ORDER` (`js/scores.js`) pour avoir un tableau de scores, puis appeler `scSubmit(jeu, mode, valeur)` à la fin d'une partie.
4. Ajouter la balise `<script>` correspondante en bas de `index.html`.
