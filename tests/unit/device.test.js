const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

// Un « navigateur » simulé : userAgent, nombre de points de contact, pointeur principal et survol
const env = ({ ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', touchPoints = 0, coarse = false, noHover = false, uaData } = {}) => ({
  navigator: Object.assign({ userAgent: ua, maxTouchPoints: touchPoints }, uaData === undefined ? {} : { userAgentData: { mobile: uaData } }),
  matchMedia: q => ({ matches: (/pointer: coarse/.test(q) && coarse) || (/hover: none/.test(q) && noHover), addEventListener() {} })
});
const files = ['js/scores.js', 'js/settings.js', 'js/device.js'];
const detect = e => load(files, env(e)).run('Device.detect()');

test('appareil : un ordinateur (souris et clavier) est détecté comme desktop', () => {
  assert.equal(detect({}), 'desktop');
  assert.equal(detect({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605', touchPoints: 0 }), 'desktop');
  assert.equal(detect({ ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120' }), 'desktop');
});

test('appareil : un portable à écran tactile reste un ordinateur (son pointeur principal est la souris)', () => {
  assert.equal(detect({ touchPoints: 10, coarse: false, noHover: false }), 'desktop');
});

test('appareil : un téléphone est détecté par son pointeur tactile et l\'absence de survol', () => {
  assert.equal(detect({ coarse: true, noHover: true }), 'mobile');
});

test('appareil : un téléphone est détecté par le navigateur (userAgentData.mobile ou chaîne User-Agent)', () => {
  assert.equal(detect({ uaData: true }), 'mobile');
  assert.equal(detect({ uaData: false, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile Safari/537' }), 'desktop');   // userAgentData prime sur la chaîne
  assert.equal(detect({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' }), 'mobile');
  assert.equal(detect({ ua: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) Mobile Safari/537' }), 'mobile');
});

test('appareil : un iPad, qui se présente comme un Mac, est détecté grâce à ses points de contact', () => {
  assert.equal(detect({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', touchPoints: 5 }), 'mobile');
});

test('appareil : le réglage manuel l\'emporte sur la détection', () => {
  const phone = load(files, env({ coarse: true, noHover: true }));
  assert.equal(phone.run('Device.mode()'), 'mobile');
  phone.exec('Settings.set("device", "desktop")');
  assert.equal(phone.run('Device.mode()'), 'desktop');
  assert.equal(phone.run('Device.isMobile()'), false);
  phone.exec('Settings.set("device", "auto")');
  assert.equal(phone.run('Device.mode()'), 'mobile');

  const pc = load(files, env({}));
  assert.equal(pc.run('Device.isMobile()'), false);
  pc.exec('Settings.set("device", "mobile")');
  assert.equal(pc.run('Device.isMobile()'), true);
});

test('appareil : une valeur de réglage inconnue est ignorée (retour à la détection)', () => {
  const pc = load(files, env({}));
  pc.exec('Settings.set("device", "tablette")');
  assert.equal(pc.run('Device.mode()'), 'desktop');
});

test('réglages : « auto » par défaut', () => {
  assert.equal(load(files, env({})).run('Settings.get("device")'), 'auto');
});
