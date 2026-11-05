import type { Knex } from 'knex';
import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { knexSnakeCaseMappers } from 'objection';

const directory = fileURLToPath(new URL('.', import.meta.url));
const extension = extname(fileURLToPath(import.meta.url));

export const migrationsDirectory = join(directory, 'migrations');
export const seedsDirectory = join(directory, 'seeds');

function isMigration(value: unknown): value is Knex.Migration {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'up') === 'function' &&
    typeof Reflect.get(value, 'down') === 'function'
  );
}

class DirectoryMigrationSource implements Knex.MigrationSource<string> {
  async getMigrations(): Promise<string[]> {
    const files = await readdir(migrationsDirectory);

    return files.filter((file) => extname(file) === extension).toSorted();
  }

  getMigrationName(migration: string): string {
    return basename(migration, extension);
  }

  async getMigration(migration: string): Promise<Knex.Migration> {
    const module: unknown = await import(pathToFileURL(join(migrationsDirectory, migration)).href);

    if (!isMigration(module)) {
      throw new Error(`Migration ${migration} must export up and down functions`);
    }

    return module;
  }
}

export function createKnexConfig(connectionString: string): Knex.Config {
  return {
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 10 },
    migrations: {
      tableName: 'knex_migrations',
      migrationSource: new DirectoryMigrationSource(),
    },
    seeds: {
      directory: seedsDirectory,
      loadExtensions: [extension],
    },
    ...knexSnakeCaseMappers(),
  };
}
