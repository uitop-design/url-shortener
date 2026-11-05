import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NotFoundError } from 'objection';
import { uniqueViolation } from '../../testing/mocks.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = jest.fn();
  let filter: AllExceptionsFilter;
  let host: ArgumentsHost;
  let errorLog: jest.SpiedFunction<Logger['error']>;

  const lastBody = (): Record<string, unknown> =>
    reply.mock.calls.at(-1)?.[1] as Record<string, unknown>;
  const lastStatus = (): unknown => reply.mock.calls.at(-1)?.[2];

  beforeEach(() => {
    reply.mockReset();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new AllExceptionsFilter({
      httpAdapter: { reply, getRequestUrl: () => '/api/links' },
    } as unknown as HttpAdapterHost);
    host = {
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders HTTP exceptions in the unified format', () => {
    filter.catch(new GoneException('Link "abc" has expired'), host);

    expect(lastBody()).toEqual({
      statusCode: 410,
      error: 'Gone',
      message: 'Link "abc" has expired',
      path: '/api/links',
      timestamp: expect.any(String),
    });
    expect(lastStatus()).toBe(410);
  });

  it('keeps validation messages as a list', () => {
    filter.catch(new BadRequestException(['url: Invalid URL', 'Unrecognized key: "x"']), host);

    expect(lastBody()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: ['url: Invalid URL', 'Unrecognized key: "x"'],
    });
  });

  it('passes through conflicts raised by services', () => {
    filter.catch(new ConflictException('Alias "x" is already taken'), host);

    expect(lastBody()).toMatchObject({ statusCode: 409, message: 'Alias "x" is already taken' });
  });

  it('maps unique violations to 409', () => {
    filter.catch(uniqueViolation(['code']), host);

    expect(lastBody()).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'A record with the same code already exists',
    });
    expect(lastStatus()).toBe(409);
  });

  it('maps Objection NotFoundError to 404', () => {
    filter.catch(new NotFoundError({}), host);

    expect(lastBody()).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it('hides unexpected errors behind a generic 500 and logs them', () => {
    filter.catch(new Error('password authentication failed for user "shortener"'), host);

    expect(lastBody()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(JSON.stringify(lastBody())).not.toContain('password');
    expect(errorLog).toHaveBeenCalled();
  });

  it('does not log client errors', () => {
    filter.catch(new BadRequestException('Invalid'), host);

    expect(errorLog).not.toHaveBeenCalled();
  });
});
