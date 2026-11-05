import type { Knex } from 'knex';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seed(knex: Knex): Promise<void> {
  const now = Date.now();

  await knex('links').del();
  await knex('links').insert([
    {
      code: 'nestjs',
      url: 'https://docs.nestjs.com',
      clicks: 42,
      lastAccessedAt: new Date(now - DAY_MS),
    },
    {
      code: 'Xk7pQ2m',
      url: 'https://github.com/uitop-design',
    },
    {
      code: 'knex-guide',
      url: 'https://knexjs.org/guide/',
      expiresAt: new Date(now + 30 * DAY_MS),
      clicks: 7,
      lastAccessedAt: new Date(now - 2 * DAY_MS),
    },
    {
      code: 'r9TbW4z',
      url: 'https://redis.io/docs/latest/develop/data-types/strings/',
      expiresAt: new Date(now + 7 * DAY_MS),
    },
    {
      code: 'black-friday',
      url: 'https://example.com/black-friday-2025',
      expiresAt: new Date(now - 3 * DAY_MS),
      clicks: 128,
      lastAccessedAt: new Date(now - 4 * DAY_MS),
      createdAt: new Date(now - 30 * DAY_MS),
      updatedAt: new Date(now - 4 * DAY_MS),
    },
  ]);
}
