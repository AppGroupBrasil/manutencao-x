// ── Push Notifications (imported by Workbox SW via importScripts) ──
self.addEventListener('push', (event) => {
  const defaultData = { titulo: 'Nova Notificação', corpo: 'Você tem uma nova atualização.', url: '/notificacoes' };
  let data = defaultData;
  try {
    if (event.data) data = { ...defaultData, ...event.data.json() };
  } catch { /* fallback to default */ }

  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.corpo,
      icon: '/logo-192.png',
      badge: '/logo-192.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const focused = clients.find((c) => c.focused);
      if (focused) {
        focused.navigate(url);
        return focused.focus();
      }
      if (clients.length > 0) {
        clients[0].navigate(url);
        return clients[0].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
