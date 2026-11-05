import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import type { Knex } from 'knex';
import { KNEX } from '../database/database.constants.js';
import { REDIS } from '../redis/redis.constants.js';

@Injectable()
export class DependenciesHealthIndicator {
  constructor(
    @Inject(KNEX) private readonly knex: Knex,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  checkPostgres(): Promise<HealthIndicatorResult> {
    return this.probe('postgres', async () => {
      await this.knex.raw('SELECT 1');
    });
  }

  checkRedis(): Promise<HealthIndicatorResult> {
    return this.probe('redis', async () => {
      await this.redis.ping();
    });
  }

  private async probe(key: string, check: () => Promise<void>): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check(key);

    try {
      await check();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}
