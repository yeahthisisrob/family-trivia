import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CacheService } from './CacheService';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new CacheService(60_000); // 1-minute default TTL
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get/set', () => {
    test('returns null for missing keys', () => {
      expect(cache.get('missing')).toBeNull();
    });

    test('returns the stored value before expiry', () => {
      cache.set('k', { a: 1 });
      expect(cache.get<{ a: number }>('k')).toEqual({ a: 1 });
    });

    test('returns null after TTL expires', () => {
      cache.set('k', 'value');
      vi.advanceTimersByTime(60_001);
      expect(cache.get('k')).toBeNull();
    });

    test('custom TTL overrides default', () => {
      cache.set('short', 'x', 1000); // 1s
      vi.advanceTimersByTime(999);
      expect(cache.get('short')).toBe('x');
      vi.advanceTimersByTime(2);
      expect(cache.get('short')).toBeNull();
    });

    test('setting same key twice overwrites the value and TTL', () => {
      cache.set('k', 'old');
      vi.advanceTimersByTime(30_000);
      cache.set('k', 'new');
      vi.advanceTimersByTime(35_000);
      // Old would have expired but new is still fresh
      expect(cache.get('k')).toBe('new');
      vi.advanceTimersByTime(30_000);
      expect(cache.get('k')).toBeNull();
    });
  });

  describe('invalidate', () => {
    test('removes a single key', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.invalidate('a');
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBe(2);
    });

    test('no-op on missing key', () => {
      expect(() => cache.invalidate('missing')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    test('removes all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clearAll();
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
    });
  });

  describe('invalidatePattern', () => {
    test('removes all keys matching the prefix', () => {
      cache.set('user_alice', 1);
      cache.set('user_bob', 2);
      cache.set('other_key', 3);
      cache.invalidatePattern('user_');
      expect(cache.get('user_alice')).toBeNull();
      expect(cache.get('user_bob')).toBeNull();
      expect(cache.get('other_key')).toBe(3);
    });
  });
});
