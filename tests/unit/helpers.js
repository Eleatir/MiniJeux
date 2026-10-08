/* Charge les scripts du jeu dans un contexte Node isolé (module `vm`), avec un faux navigateur minimal :
   pas de DOM réel, un localStorage en mémoire. Idéal pour tester la logique pure (règles, scores, dictionnaire…).
   Les tests qui ont besoin d'un vrai navigateur sont dans tests/e2e. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    get length() { return m.size; }
  };
}

function fakeElement() {
  return new Proxy(function () {}, {
    get: (_, k) => (k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === 'style' ? {} : fakeElement()),
    apply: () => fakeElement(),
    set: () => true
  });
}

/**
 * @param {string[]} files  scripts à charger, relatifs à la racine du dépôt, dans l'ordre de index.html
 * @returns {{ run: (code: string) => any, ctx: object, storage: object }}
 */
function load(files) {
  const storage = fakeStorage();
  const document = {
    documentElement: { classList: { toggle() {}, add() {}, remove() {} } },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => fakeElement(), body: fakeElement(),
    hidden: false, activeElement: null, title: ''
  };
  const sandbox = {
    document, localStorage: storage, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {},
    navigator: {}
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  // run : évalue une expression dans le contexte et renvoie le résultat sous forme de données JSON simples
  // (les objets du contexte viennent d'un autre « realm » : la copie JSON évite les soucis de prototypes)
  const run = code => {
    const out = vm.runInContext('JSON.stringify((function(){ return (' + code + '); })())', ctx);
    return out === undefined ? undefined : JSON.parse(out);
  };
  // exec : exécute des instructions sans renvoyer de valeur
  const exec = code => { vm.runInContext(code, ctx); };
  return { run, exec, ctx, storage };
}

module.exports = { load, ROOT };
