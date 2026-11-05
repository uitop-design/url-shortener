import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { UniqueViolationError } from 'objection';
import { EnvironmentVariables } from '../config/environment.js';
import { LinkModel } from '../database/models/link.model.js';
import { LinkCacheService } from '../links/link-cache.service.js';

const builderMethods = [
  'insert',
  'returning',
  'orderBy',
  'page',
  'findOne',
  'delete',
  'where',
  'patch',
] as const;

type BuilderMethod = (typeof builderMethods)[number];

export type QueryBuilderMock = Record<BuilderMethod, jest.Mock> & Promise<unknown>;

export function createQueryBuilder(outcome: {
  result?: unknown;
  error?: unknown;
}): QueryBuilderMock {
  const promise =
    'error' in outcome ? Promise.reject(outcome.error) : Promise.resolve(outcome.result);
  promise.catch(() => undefined);

  const builder = promise as QueryBuilderMock;
  for (const method of builderMethods) {
    builder[method] = jest.fn(() => builder);
  }

  return builder;
}

export function mockQueries(
  ...builders: QueryBuilderMock[]
): jest.SpiedFunction<typeof LinkModel.query> {
  const spy = jest.spyOn(LinkModel, 'query');

  for (const builder of builders) {
    spy.mockReturnValueOnce(builder as never);
  }

  return spy;
}

export function buildLink(overrides: Partial<LinkModel> = {}): LinkModel {
  return {
    id: '7f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b',
    code: 'aZ3kQ9x',
    url: 'https://example.com/article',
    expiresAt: null,
    clicks: 0,
    lastAccessedAt: null,
    createdAt: new Date('2026-11-05T12:00:00.000Z'),
    updatedAt: new Date('2026-11-05T12:00:00.000Z'),
    ...overrides,
  } as LinkModel;
}

export function uniqueViolation(columns: string[] = ['code']): UniqueViolationError {
  const UniqueViolation = UniqueViolationError as unknown as new (
    args: Record<string, unknown>,
  ) => UniqueViolationError;

  return new UniqueViolation({
    nativeError: new Error('duplicate key value violates unique constraint'),
    table: 'links',
    columns,
    constraint: 'links_code_unique',
  });
}

export function createConfig(
  values: Partial<EnvironmentVariables>,
): ConfigService<EnvironmentVariables, true> {
  return {
    get: (key: keyof EnvironmentVariables) => values[key],
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

export type LinkCacheMock = Record<'get' | 'set' | 'delete', jest.Mock>;

export function createCacheMock(): LinkCacheMock {
  return {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
  };
}

export function asLinkCache(mock: LinkCacheMock): LinkCacheService {
  return mock as unknown as LinkCacheService;
}
