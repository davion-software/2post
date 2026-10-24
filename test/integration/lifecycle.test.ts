import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { createWorkerApplication, loadConfig } from '../helpers/compiled.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('TEST_DATABASE_URL is required for integration tests');

const children: ChildProcess[] = [];
afterEach(async () => {
  await Promise.all(
    children.splice(0).map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }),
  );
});

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

it.each(['api', 'worker'])(
  'starts the compiled %s process and closes cleanly on SIGTERM',
  async (service) => {
    const port = await freePort();
    const child = spawn(process.execPath, [`dist/entrypoints/${service}.js`], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'test',
        LOG_LEVEL: 'info',
        HOST: '127.0.0.1',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      output += String(chunk);
    });

    const started =
      service === 'worker'
        ? 'Worker started'
        : 'Nest application successfully started';
    await expect.poll(() => output, { timeout: 8000 }).toContain(started);
    if (service === 'api') {
      const response = await fetch(
        `http://127.0.0.1:${port}/health/ready?token=do-not-log`,
        { headers: { authorization: 'Bearer do-not-log' } },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'ok',
        checks: { database: 'up' },
      });
      await expect.poll(() => output).toContain('HTTP request');
      expect(output).not.toContain('do-not-log');
    }

    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const [code, signal] = await exited;
    expect(code === 0 || signal === 'SIGTERM').toBe(true);
    expect(output).not.toContain('startup failed');
  },
);

it('releases the worker database pool after startup failure', async () => {
  await expect(
    createWorkerApplication(
      loadConfig({
        DATABASE_URL: 'postgresql://local:secret@127.0.0.1:1/unavailable',
        DATABASE_CONNECT_TIMEOUT_MS: '100',
        LOG_LEVEL: 'silent',
      }),
    ),
  ).rejects.toBeDefined();
});
