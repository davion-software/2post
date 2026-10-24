import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { Pool } from 'pg';
import { afterEach, expect, it } from 'vite-plus/test';
import { readEnvironment } from '../../scripts/lib/runtime.mjs';
import { freePort } from '../helpers/ports.js';

let child: ChildProcess | undefined;
const groups: number[] = [];
afterEach(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
  for (const pid of groups.splice(0)) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      /* Ya cerrado. */
    }
  }
});

it('starts API and worker together and releases the API port and database connections on SIGTERM', async () => {
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...(await readEnvironment()),
    PORT: String(port),
  };
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2000,
  });
  try {
    const before = await pool.query(
      "SELECT count(*) FROM pg_stat_activity WHERE application_name = '2post'",
    );
    const baseline: unknown = before.rows[0]?.count;
    child = spawn(process.execPath, ['scripts/dev.mjs'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    function capture(chunk: Buffer) {
      output += chunk.toString();
      for (const match of output.matchAll(/watcher pid=(\d+)/g)) {
        const pid = Number(match[1]);
        if (!groups.includes(pid)) groups.push(pid);
      }
    }
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);
    await expect
      .poll(() => output, { timeout: 20000 })
      .toContain('Worker started');
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`http://127.0.0.1:${port}/health/ready`))
              .status;
          } catch {
            return 0;
          }
        },
        { timeout: 10000 },
      )
      .toBe(200);
    expect(output).not.toContain('startup failed');
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const [code] = await exited;
    expect(code).toBe(0);
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    });
    await expect
      .poll(async () => {
        const result = await pool.query(
          "SELECT count(*) FROM pg_stat_activity WHERE application_name = '2post'",
        );
        return result.rows[0]?.count;
      })
      .toBe(baseline);
  } finally {
    await pool.end();
  }
}, 45000);

it('reports an occupied API port in machine-readable doctor output without exposing credentials', async () => {
  const port = await freePort();
  const server = createServer();
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  try {
    child = spawn(process.execPath, ['scripts/doctor.mjs', '--json'], {
      env: { ...(await readEnvironment()), PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const [code] = await once(child, 'exit');
    expect(code).toBe(1);
    const result: unknown = JSON.parse(output);
    expect(result).toMatchObject({
      ok: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ check: 'api-port', status: 'error' }),
      ]),
    });
    expect(output).not.toContain('postgresql://');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
