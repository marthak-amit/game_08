const C = 'orbfall-v2';
const FILES = ['./', 'index.html', 'css/style.css', 'js/util.js', 'js/config.js', 'js/data.js', 'js/services.js', 'js/game.js', 'js/ui.js', 'js/main.js', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); });
