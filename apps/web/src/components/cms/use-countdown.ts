'use client';
/**
 * Seconds left until a 429 or a resend cooldown ends (`cms-panel-shell.AC2`, `AC15`, `AC17`).
 * `start(seconds)` begins a countdown; `remaining` reaches 0 and stops.
 */
import { useCallback, useEffect, useState } from 'react';

export function useCountdown(): { remaining: number; start: (seconds: number) => void } {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      clearInterval(timer);
    };
  }, [until, now]);

  const start = useCallback((seconds: number) => {
    const at = Date.now();
    setNow(at);
    setUntil(at + seconds * 1_000);
  }, []);

  return { remaining: Math.max(0, Math.ceil((until - now) / 1_000)), start };
}
