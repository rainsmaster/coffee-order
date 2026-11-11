const STATIC_CACHE_NAME = 'coffee-order-static-v3';
const DYNAMIC_CACHE_NAME = 'coffee-order-dynamic-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico'
];

const API_CACHE_PATTERNS = [
  /\/api\/twosome-menus$/,
  /\/api\/departments$/
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('coffee-order-')
            && cacheName !== STATIC_CACHE_NAME
            && cacheName !== DYNAMIC_CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== location.origin
    || url.pathname === '/service-worker.js') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      event.respondWith(staleWhileRevalidateApi(request, event));
    } else {
      event.respondWith(networkFirstApi(request));
    }
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request, event));
    return;
  }

  if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/images/')
    || request.destination === 'image') {
    const cacheName = url.pathname.startsWith('/static/') ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
    event.respondWith(cacheFirst(request, cacheName, event));
    return;
  }

  event.respondWith(networkFirstStatic(request, event));
});

async function networkFirstApi(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(
      JSON.stringify({ error: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function staleWhileRevalidateApi(request, event) {
  const networkResponsePromise = fetch(request);
  event.waitUntil(
    networkResponsePromise
      .then((networkResponse) => {
        if (networkResponse.ok) {
          return cacheResponse(DYNAMIC_CACHE_NAME, request, networkResponse);
        }
        return undefined;
      })
      .catch(() => undefined)
  );

  return caches.match(request)
    .then((cachedResponse) => cachedResponse || networkResponsePromise)
    .catch(() => new Response(
      JSON.stringify({ error: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    ));
}

function networkFirstDocument(request, event) {
  const networkResponsePromise = fetch(request, { cache: 'no-store' });
  event.waitUntil(cacheNetworkResponse(networkResponsePromise, STATIC_CACHE_NAME, '/index.html'));

  return networkResponsePromise.catch(async () => {
    const cachedResponse = await caches.match('/index.html') || await caches.match('/offline.html');
    return cachedResponse || new Response('오프라인 상태입니다.', { status: 503 });
  });
}

function networkFirstStatic(request, event) {
  const networkResponsePromise = fetch(request, { cache: 'no-store' });
  event.waitUntil(cacheNetworkResponse(networkResponsePromise, STATIC_CACHE_NAME, request));

  return networkResponsePromise.catch(async () => {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('', { status: 503 });
  });
}

async function cacheFirst(request, cacheName, event) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponsePromise = fetch(request);
  event.waitUntil(cacheNetworkResponse(networkResponsePromise, cacheName, request));

  try {
    return await networkResponsePromise;
  } catch (error) {
    return new Response('', { status: request.destination === 'image' ? 404 : 503 });
  }
}

function cacheNetworkResponse(networkResponsePromise, cacheName, key) {
  return networkResponsePromise
    .then((networkResponse) => {
      if (networkResponse.ok) {
        return cacheResponse(cacheName, key, networkResponse);
      }
      return undefined;
    })
    .catch(() => undefined);
}

async function cacheResponse(cacheName, key, response) {
  try {
    const responseToCache = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(key, responseToCache);
  } catch (error) {
    console.warn('[Service Worker] Cache write failed:', key.url || key, error);
  }
}
