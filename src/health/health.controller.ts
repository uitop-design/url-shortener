import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult } from '@nestjs/terminus';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check PostgreSQL and Redis connectivity' })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto, description: 'A dependency is down' })
  check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
