const webpush = require('web-push');
const config = require('../../config');

if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
  );
}

async function send(device, notification) {
  if (!device.push_subscription) {
    throw new Error('No push subscription for PWA device');
  }

  let subscription;
  try {
    subscription = JSON.parse(device.push_subscription);
  } catch {
    throw new Error('Invalid push subscription JSON');
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body || '',
    icon: notification.icon_url || undefined,
    data: notification.data ? JSON.parse(notification.data) : undefined,
    tag: notification.id,
    timestamp: new Date(notification.created_at).getTime(),
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return { success: true };
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { success: false, expired: true, error: err.message };
    }
    throw err;
  }
}

module.exports = { send };
