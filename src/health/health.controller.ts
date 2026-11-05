import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { DependenciesHealthIndicator } from './health.indicators.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dependencies: DependenciesHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check PostgreSQL and Redis connectivity' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.dependencies.checkPostgres(),
      () => this.dependencies.checkRedis(),
    ]);
  }
}
