import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ValidationPipe } from './common/pipes/validation.pipe.js';
import { AppConfigModule } from './config/app-config.module.js';

@Module({
  imports: [AppConfigModule],
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
