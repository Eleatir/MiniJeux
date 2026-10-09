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

// ── gestes tactiles réels (événements touch envoyés au navigateur via le protocole de débogage) ──
async function touchSession(page) {
  return page.context().newCDPSession(page);
}
const center = async locator => {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
// Glisse un doigt d'un point à un autre (points {x, y}, ou locators)
async function touchDrag(page, from, to, { steps = 8, hold = 0 } = {}) {
  const client = await touchSession(page);
  const a = from.x === undefined ? await center(from) : from;
  const b = to.x === undefined ? await center(to) : to;
  const send = (type, p) => client.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  await send('touchStart', a);
  if (hold) await page.waitForTimeout(hold);
  for (let i = 1; i <= steps; i++) await send('touchMove', { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps });
  await send('touchEnd');
  await client.detach();
}
// Appui long sur un élément
async function touchHold(page, locator, ms = 700) {
  const client = await touchSession(page);
  const p = await center(locator);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await page.waitForTimeout(ms);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

module.exports = { test, expect: base.expect, modalReady, openGame, touchDrag, touchHold };
