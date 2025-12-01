// Service Worker for 커피주문 PWA
const CACHE_NAME = 'coffee-order-v1';
const STATIC_CACHE_NAME = 'coffee-order-static-v1';
const DYNAMIC_CACHE_NAME = 'coffee-order-dynamic-v1';

// 정적 리소스 - 앱 셸
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico'
];

// 캐시할 API 패턴
const API_CACHE_PATTERNS = [
  /\/api\/twosome-menus$/,
  /\/api\/departments$/
];

// 설치 이벤트 - 정적 리소스 캐싱
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // 즉시 활성화
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// 활성화 이벤트 - 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('coffee-order-') &&
                     cacheName !== STATIC_CACHE_NAME &&
                     cacheName !== DYNAMIC_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // 모든 클라이언트 즉시 제어
        return self.clients.claim();
      })
  );
});

// Fetch 이벤트 - 캐싱 전략
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 같은 origin의 요청만 처리
  if (url.origin !== location.origin) {
    return;
  }

  // API 요청 처리
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // 이미지 요청 처리
  if (url.pathname.startsWith('/images/') || request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // 정적 리소스 처리 (HTML, CSS, JS)
  event.respondWith(staleWhileRevalidateStrategy(request));
});

// 네트워크 우선 전략 (API용)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // 성공적인 응답만 캐시
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // API 실패 시 에러 응답 반환
    return new Response(
      JSON.stringify({ error: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 캐시 우선 전략 (이미지용)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Image fetch failed:', request.url);
    // 이미지 실패 시 빈 응답
    return new Response('', { status: 404 });
  }
}

// Stale-While-Revalidate 전략 (정적 리소스용)
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(STATIC_CACHE_NAME);
        cache.then((c) => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(() => {
      // 네트워크 실패 시 오프라인 페이지 반환
      if (request.destination === 'document') {
        return caches.match('/offline.html');
      }
      return null;
    });

  return cachedResponse || fetchPromise;
}

// 백그라운드 동기화 (향후 확장용)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
});

// 푸시 알림 (향후 확장용)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
});