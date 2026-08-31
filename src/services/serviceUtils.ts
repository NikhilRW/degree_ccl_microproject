/** Simulated latency so loading / error states are exercised realistically. */
export const delay = (ms = 260) => new Promise<void>((r) => setTimeout(r, ms));

export const isBrowser = typeof window !== "undefined";

export function readLocal<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — non-fatal for mock persistence */
  }
}
