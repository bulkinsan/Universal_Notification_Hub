const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./helpers');

let ctx;
let api;
let sourceA;
let sourceB;

before(async () => { ctx = await boot(); api = ctx.api; });
after(async () => { await ctx.close(); });

async function makeSource(name, domain) {
  const r = await api('/sources', { method: 'POST', body: JSON.stringify({ name, domain }) });
  assert.strictEqual(r.status, 201);
  return r.body;
}

test('setup: two independent sources', async () => {
  sourceA = await makeSource('Alpha', 'alpha.example.com');
  sourceB = await makeSource('Beta', 'beta.example.com');
});

test('source key can update its own source', async () => {
  const r = await api(`/sources/${sourceA.id}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': sourceA.api_key },
    body: JSON.stringify({ name: 'Alpha Renamed' }),
  });
  assert.strictEqual(r.status, 200);
  const check = await api(`/sources/${sourceA.id}`);
  assert.strictEqual(check.body.name, 'Alpha Renamed');
});

test('IDOR: source key cannot update another source', async () => {
  const r = await api(`/sources/${sourceB.id}`, {
    method: 'PATCH',
    headers: { 'X-API-Key': sourceA.api_key },
    body: JSON.stringify({ name: 'HIJACKED' }),
  });
  assert.strictEqual(r.status, 403);
  const check = await api(`/sources/${sourceB.id}`);
  assert.strictEqual(check.body.name, 'Beta', 'foreign source was modified');
});

test('IDOR: source key cannot upload a logo to another source', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const form = new FormData();
  form.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');

  const res = await fetch(`${ctx.base}/api/v1/sources/${sourceB.id}/logo`, {
    method: 'POST',
    headers: { 'X-API-Key': sourceA.api_key },
    body: form,
  });
  assert.strictEqual(res.status, 403);

  const check = await api(`/sources/${sourceB.id}`);
  assert.ok(!check.body.logo_path, 'foreign source received a logo');
});

test('unauthenticated PATCH is rejected', async () => {
  const r = await api(`/sources/${sourceA.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'nope' }),
  });
  assert.strictEqual(r.status, 401);
});