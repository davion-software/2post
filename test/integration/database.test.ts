import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vite-plus/test';
import { runMigrations } from '../helpers/compiled.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('TEST_DATABASE_URL is required for integration tests');

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
let client: PoolClient;

beforeAll(async () => {
  await runMigrations(databaseUrl);
  await runMigrations(databaseUrl);
});
beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});
afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});
afterAll(async () => {
  await pool.end();
});

describe('initial migrations on PostgreSQL', () => {
  it('preserves ownership and default values after applying migrations twice', async () => {
    const userId = randomUUID();
    const workspaceId = randomUUID();
    await client.query('INSERT INTO users (id, email) VALUES ($1, $2)', [
      userId,
      `${userId}@example.test`,
    ]);
    await client.query(
      'INSERT INTO workspaces (id, name, owner_user_id) VALUES ($1, $2, $3)',
      [workspaceId, 'Pilot', userId],
    );
    const result = await client.query(
      'SELECT status, version FROM workspaces WHERE id = $1',
      [workspaceId],
    );
    expect(result.rows).toEqual([{ status: 'active', version: '1' }]);
    await expect(
      client.query('DELETE FROM users WHERE id = $1', [userId]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects non-normalized email addresses', async () => {
    await expect(
      client.query('INSERT INTO users (id, email) VALUES ($1, $2)', [
        randomUUID(),
        ' Owner@Example.test ',
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects an owner that does not exist', async () => {
    await expect(
      client.query(
        'INSERT INTO workspaces (id, name, owner_user_id) VALUES ($1, $2, $3)',
        [randomUUID(), 'Pilot', randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
