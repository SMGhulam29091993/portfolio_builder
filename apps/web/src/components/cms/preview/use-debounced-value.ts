'use client';
/**
 * `value`, updated at most every `delayMs` (`cms-panel-shell.AC9`: the preview follows typing
 * within 300 ms without re-rendering the whole page on every keystroke).
 */
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return debounced;
}
