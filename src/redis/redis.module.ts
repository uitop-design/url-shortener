import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { EnvironmentVariables } from '../config/environment.js';
import { REDIS, REDIS_COMMAND_TIMEOUT_MS, REDIS_CONNECT_TIMEOUT_MS } from './redis.constants.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Redis =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
          commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
      return;
    }

    this.redis.disconnect();
  }
}
