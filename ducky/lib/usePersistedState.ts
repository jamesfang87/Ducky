"use client";

import { useEffect, useState } from "react";

/** useState that remembers its value in this browser (layout prefs only; storage may be unavailable). */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  // Read after mount so the server render and the first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
