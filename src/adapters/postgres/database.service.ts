import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DatabaseProbe } from '../../application/ports/database-probe.js';
import { AppConfig } from '../../config/environment.js';
import { users } from '../../modules/identity/identity.schema.js';
import { workspaces } from '../../modules/workspaces/workspaces.schema.js';
import { AppLogger } from '../../observability/app-logger.js';

@Injectable()
export class DatabaseService implements DatabaseProbe, OnApplicationShutdown {
  private readonly pool: Pool;
  readonly db;

  constructor(config: AppConfig, logger: AppLogger) {
    this.pool = new Pool({
      connectionString: config.values.DATABASE_URL,
      max: config.values.DATABASE_POOL_MAX,
      connectionTimeoutMillis: config.values.DATABASE_CONNECT_TIMEOUT_MS,
      query_timeout: config.values.DATABASE_QUERY_TIMEOUT_MS,
      statement_timeout: config.values.DATABASE_QUERY_TIMEOUT_MS,
      idleTimeoutMillis: 30000,
      application_name: '2post',
    });
    this.pool.on('error', () => logger.error('PostgreSQL idle client error'));
    this.db = drizzle(this.pool, { schema: { users, workspaces } });
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
