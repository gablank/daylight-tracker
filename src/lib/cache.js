/**
 * Simple LRU (Least Recently Used) cache.
 * Uses a Map (which preserves insertion order in JS) — on get, the entry
 * is moved to the end; on eviction, the first (oldest) entry is removed.
 */
export class LRUCache {
  constructor(maxSize) {
    this._max = maxSize;
    this._map = new Map();
  }

  has(key) {
    return this._map.has(key);
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    const value = this._map.get(key);
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this._max) {
      // Evict least recently used (first entry)
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, value);
  }

  get size() {
    return this._map.size;
  }

  clear() {
    this._map.clear();
  }
}

/** Cache size tiers — shared across all modules */
export const CACHE_MAX_LARGE = 200_000;  // per-day sun data (getSunData, sunPos, twilight, sunCalcTimes)
export const CACHE_MAX_MEDIUM = 5_000;   // timezone utilities (calDay, hourInTz, dateAtLocal)
export const CACHE_MAX_SMALL = 1_000;    // aggregate results (yearData, milestones, DST)
