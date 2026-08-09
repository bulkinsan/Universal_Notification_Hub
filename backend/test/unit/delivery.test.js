const { test, mock } = require('node:test');
const assert = require('node:assert');
const webpush = require('web-push');
const webPushDelivery = require('../../src/services/delivery/web-push');

test('web-push send returns success on delivery', async () => {
  mock.method(webpush, 'sendNotification', async () => {});
  try {
    const device = {
      device_type: 'pwa',
      push_subscription: JSON.stringify({ endpoint: 'https://push.example.com', keys: {} }),
    };
    const notification = {
      id: 'n-1',
      title: 'Hi',
      body: 'Body',
      icon_url: 'http://localhost/icon.png',
      data: JSON.stringify({ deep_link: 'x' }),
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const res = await webPushDelivery.send(device, notification);
    assert.deepStrictEqual(res, { success: true });

    const payload = JSON.parse(webpush.sendNotification.mock.calls[0].arguments[1]);
    assert.strictEqual(payload.title, 'Hi');
    assert.strictEqual(payload.body, 'Body');
    assert.strictEqual(payload.tag, 'n-1');
    assert.deepStrictEqual(payload.data, { deep_link: 'x' });
    assert.ok(payload.timestamp > 0);
  } finally {
    mock.restoreAll();
  }
});

test('web-push marks expired on 410', async () => {
  mock.method(webpush, 'sendNotification', async () => {
    const err = new Error('gone');
    err.statusCode = 410;
    throw err;
  });
  try {
    const device = {
      device_type: 'pwa',
      push_subscription: JSON.stringify({ endpoint: 'x', keys: {} }),
    };
    const notification = { id: 'n-2', title: 'Hi', body: '', created_at: '2026-01-01T00:00:00.000Z' };
    const res = await webPushDelivery.send(device, notification);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.expired, true);
  } finally {
    mock.restoreAll();
  }
});

test('web-push rethrows non-expiration errors', async () => {
  mock.method(webpush, 'sendNotification', async () => {
    throw new Error('network down');
  });
  try {
    const device = {
      device_type: 'pwa',
      push_subscription: JSON.stringify({ endpoint: 'x', keys: {} }),
    };
    const notification = { id: 'n-3', title: 'Hi', created_at: '2026-01-01T00:00:00.000Z' };
    await assert.rejects(() => webPushDelivery.send(device, notification), /network down/);
  } finally {
    mock.restoreAll();
  }
});

test('web-push throws when subscription missing', async () => {
  await assert.rejects(
    () => webPushDelivery.send({ device_type: 'pwa', push_subscription: null }, { title: 'Hi' }),
    /No push subscription/
  );
});

test('web-push throws on invalid subscription JSON', async () => {
  await assert.rejects(
    () => webPushDelivery.send({ device_type: 'pwa', push_subscription: 'not-json' }, { title: 'Hi' }),
    /Invalid push subscription JSON/
  );
});
