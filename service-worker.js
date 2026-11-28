const cacheName = 'vaderlek-2.20.0-shell-v6';
const files = ['index.html', 'gta-weather.js', 'gta-weather.css', 'nearest.js', 'influencer-tools.js?v=2.15.0', 'mandelbrot.js', 'fractal-worker.js', 'outfit.js?v=2.19.0', 'outfit.css?v=2.16.0', 'manifest.webmanifest', 'vadergungan-180.png', 'vadergungan-192.png', 'vadergungan-512.png'];
const assets = files.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(assets.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
async function freshFile(request, key) {
  const cache = await caches.open(cacheName);
  let response;
  try {
    response = await fetch(request, {cache: 'no-cache'});
  } catch (error) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw error;
  }
  if (response.ok) {
    try { await cache.put(key, response.clone()); } catch { /* Storage may be full. */ }
  } else if (response.status >= 500) {
    return (await cache.match(key)) || response;
  }
  return response;
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  if (event.request.mode === 'navigate' &&
      [self.registration.scope, assets[0]].includes(url.href)) {
    event.respondWith(freshFile(event.request, assets[0]));
  } else if (assets.includes(event.request.url)) {
    event.respondWith(freshFile(event.request, event.request.url));
  }
});
