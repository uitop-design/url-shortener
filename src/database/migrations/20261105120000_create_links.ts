import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('links', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('code', 32).notNullable().unique();
    table.string('url', 2048).notNullable();
    table.timestamp('expires_at', { useTz: true }).nullable();
    table.integer('clicks').notNullable().defaultTo(0);
    table.timestamp('last_accessed_at', { useTz: true }).nullable();
    table.timestamps(true, true);
    table.index(['created_at', 'id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('links');
}
