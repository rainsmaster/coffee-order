import fs from 'fs';
import path from 'path';
import vm from 'vm';

const source = fs.readFileSync(path.resolve(__dirname, '../public/service-worker.js'), 'utf8');

function createWorker() {
  const listeners = {};
  const cache = {
    put: jest.fn().mockResolvedValue(undefined),
    addAll: jest.fn().mockResolvedValue(undefined)
  };
  const context = vm.createContext({
    self: {
      addEventListener: jest.fn((name, listener) => { listeners[name] = listener; }),
      skipWaiting: jest.fn().mockResolvedValue(undefined),
      clients: { claim: jest.fn().mockResolvedValue(undefined) }
    },
    caches: {
      open: jest.fn().mockResolvedValue(cache),
      match: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(true)
    },
    fetch: jest.fn(),
    location: { origin: 'https://heodabang.me' },
    URL,
    Response,
    console: { warn: jest.fn() }
  });
  vm.runInContext(source, context);
  return { context, listeners, cache };
}

function response() {
  return {
    ok: true,
    bodyUsed: false,
    clone: jest.fn(function clone() {
      if (this.bodyUsed) {
        throw new TypeError('Response body is already used');
      }
      return { cached: true };
    })
  };
}

describe('service worker 캐시 갱신', () => {
  test('HTML 캐시 저장이 네트워크 응답 반환을 막지 않는다', async () => {
    const { context, cache } = createWorker();
    const networkResponse = response();
    let completeCacheWrite;
    cache.put.mockReturnValue(new Promise((resolve) => { completeCacheWrite = resolve; }));
    context.fetch.mockResolvedValue(networkResponse);
    const request = { url: 'https://heodabang.me/', method: 'GET' };
    const event = { waitUntil: jest.fn() };
    const networkFirstDocument = vm.runInContext('networkFirstDocument', context);

    const result = await networkFirstDocument(request, event);

    expect(context.fetch).toHaveBeenCalledWith(request, { cache: 'no-store' });
    expect(result).toBe(networkResponse);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    expect(networkResponse.clone).toHaveBeenCalledTimes(1);

    completeCacheWrite();
    await event.waitUntil.mock.calls[0][0];
    result.bodyUsed = true;
    expect(cache.put).toHaveBeenCalledWith('/index.html', { cached: true });
  });

  test('공개 API는 캐시를 즉시 반환하고 백그라운드에서 갱신한다', async () => {
    const { context, cache } = createWorker();
    const cachedResponse = { cached: true };
    const networkResponse = response();
    let finishNetwork;
    context.caches.match.mockResolvedValue(cachedResponse);
    context.fetch.mockReturnValue(new Promise((resolve) => { finishNetwork = resolve; }));
    const request = { url: 'https://heodabang.me/api/twosome-menus', method: 'GET' };
    const event = { waitUntil: jest.fn() };
    const staleWhileRevalidateApi = vm.runInContext('staleWhileRevalidateApi', context);

    const result = await staleWhileRevalidateApi(request, event);

    expect(result).toBe(cachedResponse);
    expect(context.fetch).toHaveBeenCalledTimes(1);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    expect(cache.put).not.toHaveBeenCalled();

    finishNetwork(networkResponse);
    await event.waitUntil.mock.calls[0][0];
    expect(cache.put).toHaveBeenCalledWith(request, { cached: true });
  });

  test('캐시가 없는 공개 API는 네트워크를 한 번만 호출한다', async () => {
    const { context } = createWorker();
    const networkResponse = response();
    context.fetch.mockResolvedValue(networkResponse);
    const request = { url: 'https://heodabang.me/api/departments', method: 'GET' };
    const event = { waitUntil: jest.fn() };
    const staleWhileRevalidateApi = vm.runInContext('staleWhileRevalidateApi', context);

    await expect(staleWhileRevalidateApi(request, event)).resolves.toBe(networkResponse);
    await event.waitUntil.mock.calls[0][0];
    expect(context.fetch).toHaveBeenCalledTimes(1);
  });

  test('해시가 포함된 정적 자산은 캐시를 사용하고 POST API는 가로채지 않는다', async () => {
    const { context, listeners } = createWorker();
    const cachedAsset = { cached: true };
    context.caches.match.mockResolvedValue(cachedAsset);
    const assetEvent = {
      request: {
        url: 'https://heodabang.me/static/js/main.9a943929.js',
        method: 'GET',
        destination: 'script',
        mode: 'same-origin'
      },
      respondWith: jest.fn(),
      waitUntil: jest.fn()
    };

    listeners.fetch(assetEvent);
    await expect(assetEvent.respondWith.mock.calls[0][0]).resolves.toBe(cachedAsset);
    expect(context.fetch).not.toHaveBeenCalled();

    const postEvent = {
      request: { url: 'https://heodabang.me/api/orders', method: 'POST' },
      respondWith: jest.fn()
    };
    listeners.fetch(postEvent);
    expect(postEvent.respondWith).not.toHaveBeenCalled();
  });

  test('새 서비스 워커는 이전 버전 캐시를 삭제한다', async () => {
    const { context, listeners } = createWorker();
    context.caches.keys.mockResolvedValue([
      'coffee-order-v1',
      'coffee-order-static-v1',
      'coffee-order-dynamic-v1',
      'coffee-order-static-v2',
      'coffee-order-dynamic-v2',
      'coffee-order-static-v3',
      'coffee-order-dynamic-v3',
      'another-application-cache'
    ]);
    const event = { waitUntil: jest.fn() };

    listeners.activate(event);
    await event.waitUntil.mock.calls[0][0];

    expect(context.caches.delete).toHaveBeenCalledTimes(5);
    expect(context.caches.delete).not.toHaveBeenCalledWith('coffee-order-static-v3');
    expect(context.caches.delete).not.toHaveBeenCalledWith('coffee-order-dynamic-v3');
    expect(context.caches.delete).not.toHaveBeenCalledWith('another-application-cache');
  });
});
