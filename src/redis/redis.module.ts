import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { EnvironmentVariables } from '../config/environment.js';
import { REDIS, REDIS_COMMAND_TIMEOUT_MS, REDIS_CONNECT_TIMEOUT_MS } from './redis.constants.js';

function createRedisClient(url: string): Redis {
  const logger = new Logger('Redis');
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  });
  let connected = true;

  client.on('error', (error: Error) => {
    if (connected) {
      connected = false;
      logger.warn(`Connection lost: ${error.message}`);
    }
  });
  client.on('ready', () => {
    if (!connected) {
      connected = true;
      logger.log('Connection restored');
    }
  });

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Redis =>
        createRedisClient(config.get('REDIS_URL', { infer: true })),
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
