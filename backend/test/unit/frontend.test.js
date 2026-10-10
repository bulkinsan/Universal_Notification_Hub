const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..', '..', '..');
const html = fs.readFileSync(path.join(root, 'pwa', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'pwa', 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'pwa', 'sw.js'), 'utf8');

function collectIds(src) {
  const ids = new Set();
  for (const m of src.matchAll(/id=["']([^"']+)["']/g)) ids.add(m[1]);
  return ids;
}

function collectLookups(src) {
  const ids = new Set();
  for (const m of src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) ids.add(m[1]);
  return ids;
}

test('every getElementById in the PWA resolves to an element in index.html', () => {
  const declared = collectIds(html);
  const looked = [...collectLookups(app), ...collectLookups(html)];
  const missing = looked.filter((id) => !declared.has(id));
  assert.deepStrictEqual(missing, [], `PWA looks up missing element ids: ${missing.join(', ')}`);
});

test('PWA declares the container the source list renders into', () => {
  assert.ok(html.includes('id="sources-list"'), 'index.html is missing id="sources-list"');
  assert.ok(app.includes("getElementById('sources-list')"), 'app.js does not render into #sources-list');
});

test('service worker does not declare an unused cache name', () => {
  const declaresCache = /CACHE_NAME/.test(sw);
  const hasFetchHandler = /addEventListener\(\s*['"]fetch['"]/.test(sw);
  assert.ok(
    !declaresCache || hasFetchHandler,
    'sw.js declares CACHE_NAME but registers no fetch handler — offline support is dead code'
  );
});