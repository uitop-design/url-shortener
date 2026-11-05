import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  asLinkCache,
  buildLink,
  createCacheMock,
  createConfig,
  createQueryBuilder,
  mockQueries,
  uniqueViolation,
} from '../testing/mocks.js';
import { MAX_CODE_GENERATION_ATTEMPTS } from './links.constants.js';
import { LinksService } from './links.service.js';

const NOW = new Date('2026-11-05T12:00:00.000Z');

describe('LinksService', () => {
  let cache: ReturnType<typeof createCacheMock>;
  let service: LinksService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    cache = createCacheMock();
    service = new LinksService(asLinkCache(cache), createConfig({ BASE_URL: 'https://sho.rt' }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('stores the alias as the code and builds the short URL', async () => {
      const insert = createQueryBuilder({ result: buildLink({ code: 'nest-docs' }) });
      mockQueries(insert);

      const link = await service.create({ url: 'https://example.com/article', alias: 'nest-docs' });

      expect(insert.insert).toHaveBeenCalledWith({
        code: 'nest-docs',
        url: 'https://example.com/article',
        expiresAt: null,
      });
      expect(insert.returning).toHaveBeenCalledWith('*');
      expect(link).toMatchObject({
        code: 'nest-docs',
        shortUrl: 'https://sho.rt/nest-docs',
        expiresAt: null,
        isExpired: false,
      });
    });

    it('rejects a taken alias with 409', async () => {
      mockQueries(createQueryBuilder({ error: uniqueViolation() }));

      await expect(
        service.create({ url: 'https://example.com', alias: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not retry an alias that is taken', async () => {
      const query = mockQueries(createQueryBuilder({ error: uniqueViolation() }));

      await expect(service.create({ url: 'https://example.com', alias: 'taken' })).rejects.toThrow(
        'Alias "taken" is already taken',
      );
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('generates a 7-character base62 code without an alias', async () => {
      const insert = createQueryBuilder({ result: buildLink() });
      mockQueries(insert);

      await service.create({ url: 'https://example.com/article' });

      const [[row]] = insert.insert.mock.calls as [[{ code: string }]];
      expect(row.code).toMatch(/^[0-9A-Za-z]{7}$/);
    });

    it('retries with a new code after a collision', async () => {
      const collision = createQueryBuilder({ error: uniqueViolation() });
      const success = createQueryBuilder({ result: buildLink({ code: 'Fresh01' }) });
      const query = mockQueries(collision, success);

      const link = await service.create({ url: 'https://example.com/article' });

      expect(query).toHaveBeenCalledTimes(2);
      expect(link.code).toBe('Fresh01');
    });

    it('gives up after the maximum number of collisions', async () => {
      const builders = Array.from({ length: MAX_CODE_GENERATION_ATTEMPTS }, () =>
        createQueryBuilder({ error: uniqueViolation() }),
      );
      const query = mockQueries(...builders);

      await expect(service.create({ url: 'https://example.com' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(query).toHaveBeenCalledTimes(MAX_CODE_GENERATION_ATTEMPTS);
    });

    it('rethrows errors other than unique violations', async () => {
      const failure = new Error('connection refused');
      const query = mockQueries(createQueryBuilder({ error: failure }));

      await expect(service.create({ url: 'https://example.com' })).rejects.toBe(failure);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('sets expiresAt from ttlSeconds', async () => {
      const expiresAt = new Date(NOW.getTime() + 3600 * 1000);
      const insert = createQueryBuilder({ result: buildLink({ expiresAt }) });
      mockQueries(insert);

      const link = await service.create({ url: 'https://example.com', ttlSeconds: 3600 });

      expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ expiresAt }));
      expect(link.expiresAt).toBe('2026-11-05T13:00:00.000Z');
      expect(link.isExpired).toBe(false);
    });

    it('creates a permanent link without ttlSeconds', async () => {
      const insert = createQueryBuilder({ result: buildLink() });
      mockQueries(insert);

      await service.create({ url: 'https://example.com' });

      expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
    });
  });

  describe('findAll', () => {
    it('returns a page of links, newest first', async () => {
      const list = createQueryBuilder({ result: { results: [buildLink()], total: 21 } });
      mockQueries(list);

      const page = await service.findAll({ page: 2, limit: 20 });

      expect(list.orderBy).toHaveBeenCalledWith([
        { column: 'createdAt', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]);
      expect(list.page).toHaveBeenCalledWith(1, 20);
      expect(page).toMatchObject({ total: 21, page: 2, limit: 20 });
      expect(page.items).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns link details with statistics', async () => {
      const lastAccessedAt = new Date('2026-11-05T11:00:00.000Z');
      mockQueries(createQueryBuilder({ result: buildLink({ clicks: 5, lastAccessedAt }) }));

      const link = await service.findOne('aZ3kQ9x');

      expect(link).toMatchObject({ clicks: 5, lastAccessedAt: '2026-11-05T11:00:00.000Z' });
    });

    it('marks an expired link with isExpired', async () => {
      const expiresAt = new Date(NOW.getTime() - 1000);
      mockQueries(createQueryBuilder({ result: buildLink({ expiresAt }) }));

      const link = await service.findOne('aZ3kQ9x');

      expect(link.isExpired).toBe(true);
    });

    it('throws 404 for an unknown code', async () => {
      mockQueries(createQueryBuilder({ result: undefined }));

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the link and evicts it from the cache', async () => {
      const removal = createQueryBuilder({ result: 1 });
      mockQueries(removal);

      await service.remove('aZ3kQ9x');

      expect(removal.where).toHaveBeenCalledWith({ code: 'aZ3kQ9x' });
      expect(cache.delete).toHaveBeenCalledWith('aZ3kQ9x');
    });

    it('throws 404 for an unknown code and still evicts the cache', async () => {
      mockQueries(createQueryBuilder({ result: 0 }));

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(cache.delete).toHaveBeenCalledWith('missing');
    });
  });
});
