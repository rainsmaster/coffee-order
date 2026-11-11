const createVisiblePolling = (task, delay) => {
  let timerId = null;
  let activeController = null;
  let stopped = false;

  const clearTimer = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const schedule = (wait) => {
    if (stopped) return;
    clearTimer();
    timerId = setTimeout(run, wait);
  };

  const run = async () => {
    if (stopped || document.visibilityState !== 'visible' || activeController) return;
    activeController = new AbortController();
    try {
      await task(activeController.signal);
    } catch (error) {
      if (error.name !== 'AbortError') console.error('주기 조회 실패:', error);
    } finally {
      activeController = null;
      if (!stopped && document.visibilityState === 'visible') schedule(delay);
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      clearTimer();
      activeController?.abort();
    } else {
      schedule(0);
    }
  };

  timerId = setTimeout(run, delay);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    stopped = true;
    clearTimer();
    activeController?.abort();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

export default createVisiblePolling;
