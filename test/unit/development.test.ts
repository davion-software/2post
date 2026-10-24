import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, expect, it } from 'vite-plus/test';
import { readEnvironment } from '../../scripts/lib/runtime.mjs';
import {
  ensureEnvironmentFile,
  ensureTestDatabase,
} from '../../scripts/setup.mjs';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

it('creates .env once and preserves local edits on repeated setup', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), '2post-setup-test-'));
  directories.push(directory);
  await writeFile(resolve(directory, '.env.example'), 'PORT=3000\n');
  expect(await ensureEnvironmentFile(directory)).toBe('created');
  await writeFile(resolve(directory, '.env'), 'PORT=4100\n');
  expect(await ensureEnvironmentFile(directory)).toBe('preserved');
  expect(await readFile(resolve(directory, '.env'), 'utf8')).toBe(
    'PORT=4100\n',
  );
});

it('respects exported values when reading a local .env', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), '2post-env-test-'));
  directories.push(directory);
  await writeFile(resolve(directory, '.env'), 'PORT=3000\nHOST=127.0.0.1\n');
  expect(await readEnvironment(directory, { PORT: '4100' })).toEqual({
    PORT: '4100',
    HOST: '127.0.0.1',
  });
});

it.each([
  { NODE_ENV: 'production' },
  {
    DATABASE_URL: 'postgresql://localhost/app',
    TEST_DATABASE_URL: 'postgresql://localhost/app',
  },
  {
    DATABASE_URL: 'postgresql://remote.example/app',
    TEST_DATABASE_URL: 'postgresql://remote.example/test',
  },
])(
  'rejects unsafe development database setup before connecting: %j',
  async (env) => {
    await expect(ensureTestDatabase(env)).rejects.toThrow();
  },
);
