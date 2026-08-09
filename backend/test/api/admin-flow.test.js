const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./helpers');

let ctx;
let api;
test.before(async () => { ctx = await boot(); api = ctx.api; });
test.after(async () => { await ctx.close(); });

let adminHeaders;
let sourceId;
let apiKey;

test('admin: protected endpoints require token', async () => {
  const r = await api('/admin/stats');
  assert.strictEqual(r.status, 401);
});

test('admin: login and create source', async () => {
  const login = await api('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.strictEqual(login.status, 200);
  adminHeaders = { Authorization: `Bearer ${login.body.token}` };

  const created = await api('/admin/sources', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Social', domain: 'social.example.com' }),
  });
  assert.strictEqual(created.status, 201);
  sourceId = created.body.id;
  apiKey = created.body.api_key;
});

test('admin: update and stats', async () => {
  const updated = await api(`/admin/sources/${sourceId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ description: 'Updated desc' }),
  });
  assert.strictEqual(updated.status, 200);

  const stats = await api(`/admin/sources/${sourceId}/stats`, { headers: adminHeaders });
  assert.strictEqual(stats.status, 200);
  assert.strictEqual(stats.body.id, sourceId);

  const detail = await api(`/admin/sources/${sourceId}`, { headers: adminHeaders });
  assert.strictEqual(detail.body.description, 'Updated desc');
  assert.strictEqual(detail.body.subscribers_count, 0);
});

test('admin: notification list and detail', async () => {
  // send a notification with the source key so there is data
  const notify = await api('/notify', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify({ title: 'Admin flow', body: 'Test' }),
  });
  assert.strictEqual(notify.status, 200);
  const nid = notify.body.notification_id;

  const list = await api(`/admin/notifications?source_id=${sourceId}`, { headers: adminHeaders });
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.length, 1);
  assert.strictEqual(list.body[0].id, nid);

  const detail = await api(`/admin/notifications/${nid}`, { headers: adminHeaders });
  assert.strictEqual(detail.status, 200);
  assert.strictEqual(detail.body.title, 'Admin flow');
  assert.ok(Array.isArray(detail.body.deliveries));
});

test('admin: regenerate api key invalidates old one', async () => {
  const regen = await api(`/admin/sources/${sourceId}/api-key`, {
    method: 'POST',
    headers: adminHeaders,
  });
  assert.strictEqual(regen.status, 200);
  assert.match(regen.body.api_key, /^sk_/);
  const newKey = regen.body.api_key;

  // old key no longer works
  const old = await api('/notify', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify({ title: 'Should fail' }),
  });
  assert.strictEqual(old.status, 403);

  // new key works
  const fresh = await api('/notify', {
    method: 'POST',
    headers: { 'X-API-Key': newKey },
    body: JSON.stringify({ title: 'Should pass' }),
  });
  assert.strictEqual(fresh.status, 200);
});

test('admin: deactivate hides source from public list', async () => {
  const deact = await api(`/admin/sources/${sourceId}/deactivate`, { method: 'POST', headers: adminHeaders });
  assert.strictEqual(deact.status, 200);

  const publicList = await api('/sources');
  assert.strictEqual(publicList.body.length, 0);

  const adminList = await api('/admin/sources', { headers: adminHeaders });
  assert.strictEqual(adminList.body.length, 1);
  assert.strictEqual(adminList.body[0].is_active, 0);

  // notify against inactive source -> 403
  const notify = await api('/notify', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify({ title: 'Inactive' }),
  });
  assert.strictEqual(notify.status, 403);

  const react = await api(`/admin/sources/${sourceId}/activate`, { method: 'POST', headers: adminHeaders });
  assert.strictEqual(react.status, 200);
});

test('admin: overall stats endpoint', async () => {
  const r = await api('/admin/stats', { headers: adminHeaders });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(typeof r.body.sources_total, 'number');
  assert.strictEqual(typeof r.body.deliveries_sent, 'number');
  assert.ok(r.body.sources_total >= 1);
});

test('admin: logo upload validation rejects fake image', async () => {
  const fake = new Blob([Buffer.from([0x00, 0x01, 0x02, 0x03])], { type: 'image/png' });
  const form = new FormData();
  form.append('logo', fake, 'logo.png');

  const res = await fetch(ctx.base + `/api/v1/admin/sources/${sourceId}/logo`, {
    method: 'POST',
    headers: { Authorization: adminHeaders.Authorization },
    body: form,
  });
  assert.strictEqual(res.status, 400); // magic-byte mismatch -> validation error
});
