const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./helpers');

let ctx;
test.before(async () => { ctx = await boot(); });
test.after(async () => { await ctx.close(); });

const api = (path, opts) => ctx.api(path, opts);

test('health returns ok', async () => {
  const r = await api('/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.status, 'ok');
});

test('vapid-public-key returns a string', async () => {
  const r = await api('/vapid-public-key');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(typeof r.body.publicKey, 'string');
});

test('unknown route returns 404 JSON', async () => {
  const r = await api('/no-such-endpoint');
  assert.strictEqual(r.status, 404);
  assert.strictEqual(r.body.error, 'Not found');
});

test('admin login flow', async () => {
  let r = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
  assert.strictEqual(r.status, 401);

  r = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  assert.strictEqual(r.status, 200);
  const token = r.body.token;
  assert.ok(token);

  r = await api('/admin/me');
  assert.strictEqual(r.status, 401);

  r = await api('/admin/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.role, 'admin');
});

test('admin login missing fields -> 400', async () => {
  const r = await api('/admin/login', { method: 'POST', body: JSON.stringify({}) });
  assert.strictEqual(r.status, 400);
});
