/**
 * Simple cache storage system using localStorage for offline-first UX
 */

const CACHE_PREFIX = "app_cache_";
const CACHE_EXPIRY_KEY = "_expiry";

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: no expiry)
}

export function getCachedData<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const { data, expiry } = JSON.parse(item);

    // Check if cache has expired
    if (expiry && Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return data as T;
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T, options?: CacheOptions): void {
  if (typeof window === "undefined") return;

  try {
    const expiry = options?.ttl ? Date.now() + options.ttl : null;
    const item = JSON.stringify({ data, expiry });
    localStorage.setItem(CACHE_PREFIX + key, item);
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

export function clearCachedData(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_PREFIX + key);
}

export function clearAllCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Silently fail
  }
}
