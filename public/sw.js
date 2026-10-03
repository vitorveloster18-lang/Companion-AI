/**
 * CDI Companion Service Worker
 * - Offline capabilities (preserves last CDI state & app shell)
 * - Cache of 3D assets (VRM models, textures, animations, fonts)
 * - Background Sync (message queue synchronization when back online)
 */

const CACHE_VERSION = 'cdi-companion-v1';
const APP_SHELL_CACHE = `cdi-shell-${CACHE_VERSION}`;
const ASSETS_CACHE = `cdi-assets-${CACHE_VERSION}`;
const VRM_CACHE = `cdi-vrm-${CACHE_VERSION}`;

// Precache minimal app shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache falhou parcialmente:', err);
      })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  const currentCaches = [APP_SHELL_CACHE, ASSETS_CACHE, VRM_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Removendo cache obsoleto:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore WebSockets, chrome extensions, non-GET requests
  if (request.method !== 'GET' || url.protocol.startsWith('ws') || url.protocol === 'chrome-extension:') {
    return;
  }

  // 1. VRM Models & 3D Assets (Cache-First strategy)
  if (
    url.pathname.endsWith('.vrm') ||
    url.pathname.includes('/api/models/') ||
    url.pathname.endsWith('.gltf') ||
    url.pathname.endsWith('.glb') ||
    url.pathname.endsWith('.bin')
  ) {
    event.respondWith(
      caches.open(VRM_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              return cachedResponse || new Response('Asset 3D indisponível offline', { status: 503 });
            });
        });
      })
    );
    return;
  }

  // 2. Navigation Requests (HTML / App Shell: Network-first with Cache fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return caches.open(APP_SHELL_CACHE).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/');
          });
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Fonts, Images: Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheType = url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2?|ttf)$/)
              ? ASSETS_CACHE
              : APP_SHELL_CACHE;
            caches.open(cacheType).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync Event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages' || event.tag === 'cdi-outbound-sync') {
    event.waitUntil(notifyClientsToFlushSync());
  }
});

async function notifyClientsToFlushSync() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) {
    client.postMessage({
      type: 'CDI_SYNC_TRIGGERED',
      timestamp: Date.now(),
    });
  }
}

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_ACTION_CLICKED',
            action: action || 'open',
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Client Messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'KEEP_ALIVE_PING') {
    event.source?.postMessage({ type: 'KEEP_ALIVE_PONG', timestamp: Date.now() });
  }
});
