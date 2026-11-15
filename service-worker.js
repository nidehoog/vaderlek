const cacheName = 'vaderlek-2.11.0-shell-v1';
const files = ['index.html', 'nearest.js', 'outfit.js', 'outfit.css?v=2.10.1', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const assets = files.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  if (event.request.mode === 'navigate' &&
      [self.registration.scope, assets[0]].includes(url.href)) {
    event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then(cache => cache.match(assets[0]))));
  } else if (assets.includes(event.request.url)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
  }
});