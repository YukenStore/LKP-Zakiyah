// Import OneSignal Service Worker SDK (handles push subscription & display)
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Backup push handler jika OneSignal tidak menangkap
self.addEventListener('push', (event) => {
    // Jika OneSignal sudah menangani, jangan tampilkan lagi
    if (event.__handled) return;
    
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'Notifikasi Baru', body: event.data ? event.data.text() : 'Ada pemberitahuan baru.' };
    }

    const title = data.title || data.headings?.id || data.headings?.en || 'LKP Insan Jaya';
    const options = {
        body: data.body || data.contents?.id || data.contents?.en || 'Ada pemberitahuan baru dari LKP Insan Jaya',
        icon: 'image/Logo Insan Jaya.png',
        badge: 'image/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: self.registration.scope + 'dashboard.html' }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Saat user klik notifikasi, buka halaman dashboard
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || self.registration.scope + 'dashboard.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Cek apakah ada tab yang sudah terbuka
            for (let client of windowClients) {
                if (client.url.includes('dashboard') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Kalau belum ada, buka tab baru
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Service Worker install & activate
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activate');
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Biarkan kosong, ini syarat PWA
});