import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
    application_name: '2post-migrate',
  });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve('db/migrations'),
    });
  } finally {
    await pool.end();
  }
}
