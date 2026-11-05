import knex from 'knex';
import { environmentSchema } from '../config/environment.js';
import { createKnexConfig } from './knex.config.js';

const commands = ['migrate', 'rollback', 'seed'] as const;
type Command = (typeof commands)[number];

function isCommand(value: string | undefined): value is Command {
  return commands.some((command) => command === value);
}

function countFiles(result: unknown): number {
  if (!Array.isArray(result)) {
    return 0;
  }

  const files: unknown = result.find((entry) => Array.isArray(entry));

  return Array.isArray(files) ? files.length : 0;
}

async function run(command: Command): Promise<void> {
  const { DATABASE_URL } = environmentSchema
    .pick({ DATABASE_URL: true })
    .parse({ DATABASE_URL: process.env.DATABASE_URL });
  const connection = knex(createKnexConfig(DATABASE_URL));

  try {
    if (command === 'migrate') {
      const applied = countFiles(await connection.migrate.latest());
      process.stdout.write(`${applied} migration(s) applied\n`);
    } else if (command === 'rollback') {
      const reverted = countFiles(await connection.migrate.rollback());
      process.stdout.write(`${reverted} migration(s) rolled back\n`);
    } else {
      const executed = countFiles(await connection.seed.run());
      process.stdout.write(`${executed} seed file(s) executed\n`);
    }
  } finally {
    await connection.destroy();
  }
}

const [command] = process.argv.slice(2);

if (!isCommand(command)) {
  process.stderr.write(`Usage: cli <${commands.join('|')}>\n`);
  process.exit(1);
}

await run(command);
