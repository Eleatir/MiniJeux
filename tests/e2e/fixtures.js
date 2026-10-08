const base = require('@playwright/test');

// Chaque test part d'un navigateur neuf (stockage vide), sans le message d'accueil,
// et échoue si la console du navigateur signale une erreur.
const test = base.test.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    page.on('response', r => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url()); });
    await page.addInitScript(() => { try { localStorage.setItem('minijeux.welcomed', '1'); } catch (e) {} });
    await use(page);
    base.expect(problems, 'erreurs dans le navigateur').toEqual([]);
  }
});

// Les fenêtres (scores, confirmations) ignorent les touches pendant 600 ms ; on attend qu'elles soient prêtes.
async function modalReady(page) {
  await page.locator('.sc-panel').waitFor();
  await page.waitForFunction(() => Date.now() - scUI.t > 650);
}

// Ouvre un jeu depuis le menu
async function openGame(page, name) {
  await page.goto('/');
  await page.locator('.card', { hasText: name }).click();
}

module.exports = { test, expect: base.expect, modalReady, openGame };
