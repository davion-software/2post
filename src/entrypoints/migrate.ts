import { runMigrations } from '../adapters/postgres/migrate.js';
import { loadConfig } from '../config/environment.js';
import { AppLogger } from '../observability/app-logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new AppLogger(config, 'migrate');
  await runMigrations(config.values.DATABASE_URL);
  logger.log('Migrations applied', 'Database');
}

void main().catch(() => {
  console.error(
    'Migration failed. Check configuration and database availability.',
  );
  process.exitCode = 1;
});
