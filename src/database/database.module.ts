import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex from 'knex';
import type { Knex } from 'knex';
import { Model } from 'objection';
import { EnvironmentVariables } from '../config/environment.js';
import { KNEX } from './database.constants.js';
import { createKnexConfig } from './knex.config.js';

@Global()
@Module({
  providers: [
    {
      provide: KNEX,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Knex => {
        const connection = knex(createKnexConfig(config.get('DATABASE_URL', { infer: true })));
        Model.knex(connection);
        return connection;
      },
    },
  ],
  exports: [KNEX],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(KNEX) private readonly connection: Knex) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.destroy();
  }
}
