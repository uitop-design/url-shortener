import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, RouterModule } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ValidationPipe } from './common/pipes/validation.pipe.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { LinksModule } from './links/links.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    LinksModule,
    RouterModule.register([{ path: 'api', children: [LinksModule] }]),
  ],
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
