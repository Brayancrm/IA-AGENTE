// Service Worker para PWA + Firebase Cloud Messaging (notificações em segundo plano)
// v3: FCM compat — mesma origem que o cliente Firebase (chaves públicas do projeto).
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseSwConfig = {
  apiKey: 'AIzaSyAT07qPBMudS0PF6-Ir-aQQhGUPJKE54n4',
  authDomain: 'ia-agente-b2f46.firebaseapp.com',
  databaseURL: 'https://ia-agente-b2f46.firebaseio.com',
  projectId: 'ia-agente-b2f46',
  storageBucket: 'ia-agente-b2f46.firebasestorage.app',
  messagingSenderId: '915148785133',
  appId: '1:915148785133:web:90e381fe612842769e53e4'
};

try {
  if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp(firebaseSwConfig);
  }
  if (typeof firebase !== 'undefined' && firebase.messaging) {
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title =
        (payload.notification && payload.notification.title) ||
        (payload.data && payload.data.title) ||
        'dadosIA';
      const body =
        (payload.notification && payload.notification.body) ||
        (payload.data && payload.data.body) ||
        '';
      const options = {
        body: body || undefined,
        icon: '/logo.png',
        badge: '/logo.png',
        data: payload.data || {}
      };
      return self.registration.showNotification(title, options);
    });
  }
} catch (e) {
  console.error('Service Worker: FCM init', e);
}

// v2: não interceptar pedidos cross-origin (Firebase Storage, Google APIs, etc.)
const CACHE_NAME = 'whatsapp-sales-agent-v3';
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
