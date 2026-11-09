const STATIC_CACHE_NAME = 'coffee-order-static-v2';
const DYNAMIC_CACHE_NAME = 'coffee-order-dynamic-v2';

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
    event.respondWith(networkFirstApi(request, url.pathname));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/images/')
    || request.destination === 'image') {
    const cacheName = url.pathname.startsWith('/static/') ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
    event.respondWith(cacheFirst(request, cacheName));
    return;
  }

  event.respondWith(networkFirstStatic(request));
});

async function networkFirstApi(request, pathname) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok && API_CACHE_PATTERNS.some((pattern) => pattern.test(pathname))) {
      await cacheResponse(DYNAMIC_CACHE_NAME, request, networkResponse);
    }
    return networkResponse;
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

async function networkFirstDocument(request) {
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse.ok) {
      await cacheResponse(STATIC_CACHE_NAME, '/index.html', networkResponse);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match('/index.html') || await caches.match('/offline.html');
    return cachedResponse || new Response('오프라인 상태입니다.', { status: 503 });
  }
}

async function networkFirstStatic(request) {
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse.ok) {
      await cacheResponse(STATIC_CACHE_NAME, request, networkResponse);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('', { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cacheResponse(cacheName, request, networkResponse);
    }
    return networkResponse;
  } catch (error) {
    return new Response('', { status: request.destination === 'image' ? 404 : 503 });
  }
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
