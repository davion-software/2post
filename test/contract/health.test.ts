import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
  DatabaseService,
  createApiApplication,
  loadConfig,
} from '../helpers/compiled.js';

const config = loadConfig({
  DATABASE_URL: 'postgresql://local:local@127.0.0.1:1/unavailable',
  LOG_LEVEL: 'silent',
  DATABASE_CONNECT_TIMEOUT_MS: '100',
});

let app: Awaited<ReturnType<typeof createApiApplication>> | undefined;
afterEach(async () => {
  await app?.close();
});

describe('compiled API and Nest dependency injection', () => {
  it('keeps liveness up and returns readiness 503 when PostgreSQL is unavailable', async () => {
    app = await createApiApplication(config);
    await app.init();
    const live = await app.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'ok' });
    expect(live.headers['cache-control']).toBe('no-store');

    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({
      status: 'not_ready',
      checks: { database: 'down' },
    });
    expect(ready.body).not.toContain('postgresql');
  });

  it('reports database readiness and generates its own request identifiers', async () => {
    app = await createApiApplication(config);
    vi.spyOn(app.get(DatabaseService), 'ping').mockResolvedValue();
    await app.init();
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
      headers: { 'x-request-id': 'untrusted-client-value' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-request-id']).not.toBe('untrusted-client-value');
  });
});
