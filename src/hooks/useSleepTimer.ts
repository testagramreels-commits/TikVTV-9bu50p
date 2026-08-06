import { useState, useEffect, useRef, useCallback } from 'react';

export interface SleepTimerState {
  active:       boolean;
  remaining:    number; // seconds
  durationMins: number; // total duration set
  set:          (minutes: number) => void;
  cancel:       () => void;
  onExpire?:    () => void;
}

export function useSleepTimer(onExpire?: () => void): SleepTimerState {
  const [active,       setActive]       = useState(false);
  const [remaining,    setRemaining]    = useState(0);
  const [durationMins, setDurationMins] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const endTimeRef  = useRef<number>(0);

  const cancel = useCallback(() => {
    clearInterval(intervalRef.current);
    setActive(false);
    setRemaining(0);
  }, []);

  const set = useCallback((minutes: number) => {
    clearInterval(intervalRef.current);
    const endMs = Date.now() + minutes * 60 * 1000;
    endTimeRef.current = endMs;
    setRemaining(minutes * 60);
    setDurationMins(minutes);
    setActive(true);

    intervalRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(intervalRef.current);
        setActive(false);
        onExpire?.();
      }
    }, 1000);
  }, [onExpire]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { active, remaining, durationMins, set, cancel };
}
