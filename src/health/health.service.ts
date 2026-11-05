import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { DependenciesHealthIndicator } from './health.indicators.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dependencies: DependenciesHealthIndicator,
  ) {}

  async check(): Promise<HealthCheckResult> {
    try {
      return await this.health.check([
        () => this.dependencies.checkPostgres(),
        () => this.dependencies.checkRedis(),
      ]);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        const failed = this.failedDependencies(error.getResponse());
        throw new ServiceUnavailableException(`Unavailable dependencies: ${failed.join(', ')}`);
      }
      throw error;
    }
  }

  private failedDependencies(response: string | object): string[] {
    const details: unknown = typeof response === 'object' ? Reflect.get(response, 'error') : null;

    return typeof details === 'object' && details !== null ? Object.keys(details) : [];
  }
}
