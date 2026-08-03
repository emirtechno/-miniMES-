import { useEffect, useRef } from 'react';

export const useNonOverlappingPolling = (callback, {
  enabled = true,
  intervalMs,
  runImmediately = true,
  resetKey,
}) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    let timerId;
    let activeController;

    const run = async () => {
      activeController = new AbortController();
      try {
        await callbackRef.current(activeController.signal);
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Arka plan yenilemesi başarısız:', error);
        }
      } finally {
        activeController = undefined;
        if (!stopped) {
          timerId = window.setTimeout(run, intervalMs);
        }
      }
    };

    timerId = window.setTimeout(run, runImmediately ? 0 : intervalMs);
    return () => {
      stopped = true;
      window.clearTimeout(timerId);
      activeController?.abort();
    };
  }, [enabled, intervalMs, resetKey, runImmediately]);
};
