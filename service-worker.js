const cacheName = 'vaderlek-2.20.0-shell-v5';
const files = ['index.html', 'gta-weather.js', 'gta-weather.css', 'nearest.js', 'influencer-tools.js?v=2.15.0', 'mandelbrot.js', 'fractal-worker.js', 'outfit.js?v=2.19.0', 'outfit.css?v=2.16.0', 'manifest.webmanifest', 'vadergungan-180.png', 'vadergungan-192.png', 'vadergungan-512.png'];
const assets = files.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets.map(url => new Request(url, {cache: 'reload'})))));
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
