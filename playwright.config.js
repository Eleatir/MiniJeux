// Tests de bout en bout : un vrai Chromium joue réellement à chaque jeu (voir tests/e2e).
// PW_CHROMIUM_PATH : chemin d'un Chromium déjà installé (utile hors CI) ; sinon celui téléchargé par `npx playwright install chromium`.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  projects: [
    // Ordinateur : souris et clavier (tous les tests sauf ceux d'extension .mobile.spec.js)
    { name: 'desktop', testIgnore: /.*\.mobile\.spec\.js/, use: { viewport: { width: 1280, height: 900 } } },
    // Téléphone : écran tactile émulé (Pixel 7), uniquement les tests *.mobile.spec.js
    { name: 'mobile', testMatch: /.*\.mobile\.spec\.js/, use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'node tests/serve.js',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI
  }
});
