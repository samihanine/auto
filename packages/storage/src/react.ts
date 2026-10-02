import { useEffect, useState } from "react";

/** useState persisted in localStorage (per-browser UI state; falls back to memory). */
export function useLocalState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage unavailable: keep the state in memory only
    }
  }, [key, state]);
  return [state, setState] as const;
}
