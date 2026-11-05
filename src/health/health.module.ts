import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { DependenciesHealthIndicator } from './health.indicators.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DependenciesHealthIndicator],
})
export class HealthModule {}
