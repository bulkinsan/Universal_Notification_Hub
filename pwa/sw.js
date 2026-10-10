const PWA_BASE = '/pwa/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('push', (e) => {
  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: 'Notification Hub', body: e.data.text() };
  }

  e.waitUntil(
    self.registration.showNotification(data.title || 'Notification Hub', {
      body: data.body || '',
      icon: data.icon || '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag: data.tag || 'default',
      timestamp: data.timestamp || Date.now(),
      data: data.data || null,
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.deep_link) || PWA_BASE;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const match = cs.find((c) => c.url === url);
      return match ? match.focus() : clients.openWindow(url);
    })
  );
});
