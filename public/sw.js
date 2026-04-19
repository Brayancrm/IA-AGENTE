// Service Worker para PWA
// v2: não interceptar pedidos cross-origin (Firebase Storage, Google APIs, etc.) —
//     o SW a quebrar o fluxo CORS e o .catch devolver undefined gera TypeError em Response.
const CACHE_NAME = 'whatsapp-sales-agent-v2';
const urlsToCache = ['/', '/globals.css', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Erro ao fazer cache', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Removendo cache antigo', cacheName);
            return caches.delete(cacheName);
          }
          return undefined;
        })
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Deixar o browser tratar sozinho: Storage, Auth, RTDB, outros domínios Google/Firebase
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        const responseToCache = response.clone();
        if (req.method === 'GET' && response.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || Response.error())
      )
  );
});
