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
  test('HTML은 HTTP 캐시를 우회하고 캐시 저장 후 응답을 반환한다', async () => {
    const { context, cache } = createWorker();
    const networkResponse = response();
    let completeCacheWrite;
    cache.put.mockReturnValue(new Promise((resolve) => { completeCacheWrite = resolve; }));
    context.fetch.mockResolvedValue(networkResponse);
    const request = { url: 'https://heodabang.me/', method: 'GET' };
    const networkFirstDocument = vm.runInContext('networkFirstDocument', context);

    let completed = false;
    const resultPromise = networkFirstDocument(request).then((result) => {
      completed = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(context.fetch).toHaveBeenCalledWith(request, { cache: 'no-store' });
    expect(networkResponse.clone).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);

    completeCacheWrite();
    const result = await resultPromise;
    result.bodyUsed = true;

    expect(result).toBe(networkResponse);
    expect(cache.put).toHaveBeenCalledWith('/index.html', { cached: true });
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
      respondWith: jest.fn()
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
      'another-application-cache'
    ]);
    const event = { waitUntil: jest.fn() };

    listeners.activate(event);
    await event.waitUntil.mock.calls[0][0];

    expect(context.caches.delete).toHaveBeenCalledTimes(3);
    expect(context.caches.delete).not.toHaveBeenCalledWith('coffee-order-static-v2');
    expect(context.caches.delete).not.toHaveBeenCalledWith('another-application-cache');
  });
});
