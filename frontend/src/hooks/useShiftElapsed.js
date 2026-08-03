import { useEffect, useMemo, useState } from 'react';
import { formatElapsed } from '../utils/formatElapsed';

/**
 * Local timer hook — keeps ticking out of ShiftSessionContext to avoid
 * re-rendering the entire authenticated shell every second.
 */
export function useShiftElapsed(startedAt, active = true) {
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    if (!active || !startedAt) {
      setNowTick(0);
      return undefined;
    }
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);

  return useMemo(() => {
    if (!active || !startedAt || !nowTick) return '—';
    return formatElapsed(startedAt, nowTick);
  }, [active, startedAt, nowTick]);
}

export function useSetupElapsed(setupStartedAt, inSetup = false) {
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    if (!inSetup || !setupStartedAt) {
      setNowTick(0);
      return undefined;
    }
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [inSetup, setupStartedAt]);

  return useMemo(() => {
    if (!inSetup || !setupStartedAt || !nowTick) return null;
    return formatElapsed(setupStartedAt, nowTick);
  }, [inSetup, setupStartedAt, nowTick]);
}
