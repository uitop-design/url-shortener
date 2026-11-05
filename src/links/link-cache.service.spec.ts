import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { createConfig } from '../testing/mocks.js';
import { LinkCacheService } from './link-cache.service.js';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const MAX_TTL_SECONDS = 86400;

describe('LinkCacheService', () => {
  const redis = {
    get: jest.fn<(key: string) => Promise<string | null>>(),
    set: jest.fn<(...args: unknown[]) => Promise<'OK'>>(),
    del: jest.fn<(key: string) => Promise<number>>(),
  };
  let service: LinkCacheService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    redis.get.mockReset().mockResolvedValue(null);
    redis.set.mockReset().mockResolvedValue('OK');
    redis.del.mockReset().mockResolvedValue(1);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new LinkCacheService(
      redis as unknown as Redis,
      createConfig({ REDIRECT_CACHE_TTL_SECONDS: MAX_TTL_SECONDS }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('caches a permanent link with the fixed TTL', async () => {
    await service.set('abc', { url: 'https://example.com', expiresAt: null });

    expect(redis.set).toHaveBeenCalledWith(
      'link:abc',
      JSON.stringify({ url: 'https://example.com', expiresAt: null }),
      'PX',
      MAX_TTL_SECONDS * 1000,
    );
  });

  it('caches an expiring link for its remaining lifetime', async () => {
    const expiresAt = new Date(NOW.getTime() + 90_000);

    await service.set('abc', { url: 'https://example.com', expiresAt });

    expect(redis.set).toHaveBeenCalledWith('link:abc', expect.any(String), 'PX', 90_000);
  });

  it('caps the TTL of long-lived links at the fixed TTL', async () => {
    const expiresAt = new Date(NOW.getTime() + 30 * MAX_TTL_SECONDS * 1000);

    await service.set('abc', { url: 'https://example.com', expiresAt });

    expect(redis.set).toHaveBeenCalledWith(
      'link:abc',
      expect.any(String),
      'PX',
      MAX_TTL_SECONDS * 1000,
    );
  });

  it('does not cache an already expired link', async () => {
    await service.set('abc', { url: 'https://example.com', expiresAt: NOW });

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('reads a cached link back with its expiration date', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', expiresAt: '2026-11-05T13:00:00.000Z' }),
    );

    await expect(service.get('abc')).resolves.toEqual({
      url: 'https://example.com',
      expiresAt: new Date('2026-11-05T13:00:00.000Z'),
    });
    expect(redis.get).toHaveBeenCalledWith('link:abc');
  });

  it('drops a malformed cache entry', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ url: 42 }));

    await expect(service.get('abc')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith('link:abc');
  });

  it('treats Redis failures as cache misses', async () => {
    redis.get.mockRejectedValue(new Error('Connection is closed'));
    redis.set.mockRejectedValue(new Error('Connection is closed'));
    redis.del.mockRejectedValue(new Error('Connection is closed'));

    await expect(service.get('abc')).resolves.toBeNull();
    await expect(
      service.set('abc', { url: 'https://example.com', expiresAt: null }),
    ).resolves.toBeUndefined();
    await expect(service.delete('abc')).resolves.toBeUndefined();
  });
});
