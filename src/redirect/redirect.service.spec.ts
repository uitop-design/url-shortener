import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GoneException, NotFoundException } from '@nestjs/common';
import {
  asLinkCache,
  buildLink,
  createCacheMock,
  createQueryBuilder,
  mockQueries,
} from '../testing/mocks.js';
import { RedirectService } from './redirect.service.js';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const URL = 'https://example.com/article';

describe('RedirectService', () => {
  let cache: ReturnType<typeof createCacheMock>;
  let service: RedirectService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    cache = createCacheMock();
    service = new RedirectService(asLinkCache(cache));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('serves a cache hit and counts the click atomically', async () => {
    cache.get.mockReturnValueOnce(Promise.resolve({ url: URL, expiresAt: null }));
    const visit = createQueryBuilder({ result: 1 });
    const query = mockQueries(visit);

    await expect(service.resolve('aZ3kQ9x')).resolves.toBe(URL);

    expect(query).toHaveBeenCalledTimes(1);
    expect(visit.where).toHaveBeenCalledWith({ code: 'aZ3kQ9x' });
    const [[patch]] = visit.patch.mock.calls as [[{ clicks: unknown; lastAccessedAt: Date }]];
    expect(patch.lastAccessedAt).toEqual(NOW);
    expect(patch.clicks).toMatchObject({ _sql: '?? + 1', _args: ['clicks'] });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('loads a cache miss from the database and caches it', async () => {
    const expiresAt = new Date(NOW.getTime() + 60_000);
    mockQueries(
      createQueryBuilder({ result: buildLink({ url: URL, expiresAt }) }),
      createQueryBuilder({ result: 1 }),
    );

    await expect(service.resolve('aZ3kQ9x')).resolves.toBe(URL);

    expect(cache.set).toHaveBeenCalledWith('aZ3kQ9x', { url: URL, expiresAt });
  });

  it('rejects an expired cached link with 410 and evicts it', async () => {
    cache.get.mockReturnValueOnce(
      Promise.resolve({ url: URL, expiresAt: new Date(NOW.getTime() - 1) }),
    );
    const query = mockQueries();

    await expect(service.resolve('aZ3kQ9x')).rejects.toBeInstanceOf(GoneException);

    expect(cache.delete).toHaveBeenCalledWith('aZ3kQ9x');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an expired link from the database with 410 without counting it', async () => {
    const lookup = createQueryBuilder({
      result: buildLink({ expiresAt: new Date(NOW.getTime() - 1000) }),
    });
    const query = mockQueries(lookup);

    await expect(service.resolve('aZ3kQ9x')).rejects.toBeInstanceOf(GoneException);

    expect(query).toHaveBeenCalledTimes(1);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown code', async () => {
    mockQueries(createQueryBuilder({ result: undefined }));

    await expect(service.resolve('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('evicts a stale cache entry whose link was deleted and returns 404', async () => {
    cache.get.mockReturnValueOnce(Promise.resolve({ url: URL, expiresAt: null }));
    mockQueries(createQueryBuilder({ result: 0 }), createQueryBuilder({ result: undefined }));

    await expect(service.resolve('aZ3kQ9x')).rejects.toBeInstanceOf(NotFoundException);

    expect(cache.delete).toHaveBeenCalledWith('aZ3kQ9x');
  });

  it('returns 404 when the link disappears between lookup and click update', async () => {
    mockQueries(createQueryBuilder({ result: buildLink() }), createQueryBuilder({ result: 0 }));

    await expect(service.resolve('aZ3kQ9x')).rejects.toBeInstanceOf(NotFoundException);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
