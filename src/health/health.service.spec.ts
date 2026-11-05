import { describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { DependenciesHealthIndicator } from './health.indicators.js';
import { HealthService } from './health.service.js';

function createService(check: () => Promise<HealthCheckResult>): HealthService {
  return new HealthService(
    { check: jest.fn(check) } as unknown as HealthCheckService,
    {} as DependenciesHealthIndicator,
  );
}

describe('HealthService', () => {
  it('returns the result when every dependency is up', async () => {
    const result: HealthCheckResult = { status: 'ok', info: {}, error: {}, details: {} };

    await expect(createService(() => Promise.resolve(result)).check()).resolves.toBe(result);
  });

  it('names the unavailable dependencies without leaking their errors', async () => {
    const service = createService(() =>
      Promise.reject(
        new ServiceUnavailableException({
          status: 'error',
          error: { redis: { status: 'down', message: 'connect ECONNREFUSED 10.0.0.5:6379' } },
        }),
      ),
    );

    const error = await service.check().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).message).toBe('Unavailable dependencies: redis');
  });
});
