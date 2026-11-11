import createVisiblePolling from './polling';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('createVisiblePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('이전 요청이 끝나기 전에는 다음 요청을 시작하지 않는다', async () => {
    let finish;
    const task = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const stop = createVisiblePolling(task, 5000);

    jest.advanceTimersByTime(5000);
    jest.advanceTimersByTime(15000);
    expect(task).toHaveBeenCalledTimes(1);

    finish();
    await flush();
    jest.advanceTimersByTime(5000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });

  test('숨겨진 탭의 요청을 중단하고 정리 후에는 다시 실행하지 않는다', async () => {
    const signals = [];
    const task = jest.fn((signal) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    const stop = createVisiblePolling(task, 5000);

    jest.advanceTimersByTime(5000);
    expect(signals[0].aborted).toBe(false);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(signals[0].aborted).toBe(true);

    stop();
    jest.advanceTimersByTime(30000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(true);
  });
});
