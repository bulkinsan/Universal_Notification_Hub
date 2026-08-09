const { test } = require('node:test');
const assert = require('node:assert');
const { boot } = require('./helpers');

let ctx;
let api;
test.before(async () => { ctx = await boot(); api = ctx.api; });
test.after(async () => { await ctx.close(); });

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('full flow: source -> subscribe -> notify -> history', async () => {
  // create source (public)
  const created = await api('/sources', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bank', domain: 'bank.example.com', website_url: 'https://bank.example.com' }),
  });
  assert.strictEqual(created.status, 201);
  assert.match(created.body.api_key, /^sk_/);
  const sourceId = created.body.id;
  const apiKey = created.body.api_key;

  // duplicate domain rejected
  const dup = await api('/sources', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bank Clone', domain: 'bank.example.com' }),
  });
  assert.strictEqual(dup.status, 409);

  // invalid input rejected
  const bad = await api('/sources', { method: 'POST', body: JSON.stringify({ name: '', domain: '' }) });
  assert.strictEqual(bad.status, 400);

  // source visible in public list
  const list = await api('/sources');
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.length, 1);
  assert.strictEqual(list.body[0].domain, 'bank.example.com');

  // subscribe user with a fake push subscription
  const sub = await api('/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      user_id: USER_ID,
      source_id: sourceId,
      device_type: 'pwa',
      push_subscription: { endpoint: 'https://push.example.com/e', keys: { p256dh: 'a', auth: 'b' } },
    }),
  });
  assert.strictEqual(sub.status, 200);
  assert.strictEqual(sub.body.status, 'subscribed');

  // user subscriptions list
  const subs = await api(`/subscribe?user_id=${USER_ID}`);
  assert.strictEqual(subs.status, 200);
  assert.strictEqual(subs.body.length, 1);

  // invalid device_type rejected
  const badDev = await api('/subscribe', {
    method: 'POST',
    body: JSON.stringify({ user_id: USER_ID, source_id: sourceId, device_type: 'carrier_pigeon' }),
  });
  assert.strictEqual(badDev.status, 400);

  // notify without key -> 401
  const noKey = await api('/notify', { method: 'POST', body: JSON.stringify({ title: 'X' }) });
  assert.strictEqual(noKey.status, 401);

  // notify with key (delivery will fail: no real push service, but request accepted)
  const notify = await api('/notify', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify({ title: 'Hello', body: 'World', data: { deep_link: 'x' } }),
  });
  assert.strictEqual(notify.status, 200);
  assert.strictEqual(notify.body.total, 1);
  assert.ok(notify.body.notification_id);

  // user history contains the notification
  const history = await api(`/notifications?user_id=${USER_ID}`);
  assert.strictEqual(history.status, 200);
  assert.strictEqual(history.body.length, 1);
  assert.strictEqual(history.body[0].title, 'Hello');

  // history requires valid user_id
  const noUser = await api('/notifications?user_id=bogus');
  assert.strictEqual(noUser.status, 400);

  // unsubscribe
  const unsub = await api('/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ user_id: USER_ID, source_id: sourceId }),
  });
  assert.strictEqual(unsub.status, 200);

  // after unsubscribe, user subscriptions list is empty
  const subsAfter = await api(`/subscribe?user_id=${USER_ID}`);
  assert.strictEqual(subsAfter.body.length, 0);
});

test('subscribe requires existing active source', async () => {
  const r = await api('/subscribe', {
    method: 'POST',
    body: JSON.stringify({ user_id: USER_ID, source_id: 'missing-id', device_type: 'pwa' }),
  });
  assert.strictEqual(r.status, 404);
});
