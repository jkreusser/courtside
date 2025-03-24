// Diese Datei wird durch next-pwa ersetzt, aber wir brauchen sie für die initiale Konfiguration

self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        fetch(event.request)
            .catch(function () {
                return caches.match(event.request);
            })
    );
}); 