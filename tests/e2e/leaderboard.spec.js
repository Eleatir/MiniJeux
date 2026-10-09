const { test, expect, modalReady } = require('./fixtures');

const URL_ = 'https://lb.test/exec';
// Active le classement général avec un faux serveur
async function withServer(page, { entries = [], broken = false } = {}) {
  const posts = [];
  await page.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `const LEADERBOARD_URL = '${URL_}';` }));
  await page.route(URL_ + '**', async r => {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*' };
    if (broken) return r.fulfill({ headers: cors, contentType: 'application/json', body: '{"ok":false}' });   // réponse invalide du service
    if (req.method() === 'POST') { posts.push(JSON.parse(req.postData())); return r.fulfill({ headers: cors, contentType: 'application/json', body: '{"ok":true}' }); }
    return r.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ ok: true, entries }) });
  });
  return posts;
}
const open = async page => { await page.goto('/'); await page.evaluate(() => scShow('snake')); await modalReady(page); };

test('« Moi » est affiché par défaut, « Tous » indique que le classement n\'est pas activé', async ({ page }) => {
  await open(page);
  await expect(page.locator('.sc-scope .on')).toContainText('Moi');
  await page.locator('.sc-scope [data-s="all"]').click();
  await expect(page.locator('.sc-status')).toContainText('non activé');
});

test('« Tous » affiche le classement général et met mes scores en évidence', async ({ page }) => {
  await withServer(page, { entries: [{ n: 'ZED', v: 90, d: 1700000000000, mine: false }, { n: 'ABC', v: 40, d: 1700000001000, mine: true }] });
  await open(page);
  await page.locator('.sc-scope [data-s="all"]').click();
  await expect(page.locator('.sc-row').first()).toContainText('ZED');
  await expect(page.locator('.sc-row.hi')).toContainText('ABC');
  await expect(page.locator('[data-a="reset"]')).toHaveCount(0);
  await page.locator('.sc-scope [data-s="me"]').click();
  await expect(page.locator('.sc-row.empty').first()).toBeVisible();
});

test('serveur injoignable : message clair, le reste fonctionne', async ({ page }) => {
  await withServer(page, { broken: true });
  await open(page);
  await page.locator('.sc-scope [data-s="all"]').click();
  await expect(page.locator('.sc-status')).toContainText('injoignable');
  await page.locator('.sc-scope [data-s="me"]').click();
  await expect(page.locator('.sc-scope .on')).toContainText('Moi');
});

test('un nouveau score est envoyé au classement général avec l\'identifiant de l\'appareil', async ({ page }) => {
  const posts = await withServer(page);
  await page.goto('/');
  await page.evaluate(() => scSubmit('snake', 'medium', 42));
  await modalReady(page);
  await page.keyboard.type('zed');
  await page.keyboard.press('Enter');
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({ action: 'submit', game: 'snake', mode: 'medium', v: 42, n: 'ZED' });
  expect(posts[0].pid).toMatch(/^[a-z0-9]{16}$/);
});
