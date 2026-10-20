// Senda service worker: app shell offline + mapas cache-first
const SHELL = 'senda-shell-v2';
const TILES = 'senda-tiles';
const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];
const TILE_HOSTS = ['tile.opentopomap.org', 'tile.openstreetmap.org', 'server.arcgisonline.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k.startsWith('senda-shell') && k !== SHELL).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (TILE_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req.url);
      if (hit) return hit;
      try {
        let res;
        try { res = await fetch(req.url, { mode: 'cors' }); }
        catch (_) { res = await fetch(req.url, { mode: 'no-cors' }); }
        if (res.ok || res.type === 'opaque') cache.put(req.url, res.clone());
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    // network-first for la app (para recibir mejoras), cache si no hay red
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = url.origin === location.origin ? await fetch(req.url, { cache: 'no-cache' }) : await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (_) {
        return (await cache.match(req)) || (await cache.match('./index.html')) || new Response('Sin conexión', { status: 503 });
      }
    })());
  }
});
