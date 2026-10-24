import { describe, expect, it } from 'vite-plus/test';
import { loadConfig } from '../helpers/compiled.js';

const databaseUrl = 'postgresql://local:local@localhost:5432/two_post_test';

describe('configuration', () => {
  it('parses environment variables and applies bounded defaults', () => {
    const config = loadConfig({ DATABASE_URL: databaseUrl, PORT: '3100' });
    expect(config.values.PORT).toBe(3100);
    expect(config.values.DATABASE_POOL_MAX).toBe(10);
    expect(Object.isFrozen(config.values)).toBe(true);
  });

  it.each([
    {},
    { DATABASE_URL: 'https://localhost/database' },
    { DATABASE_URL: databaseUrl, PORT: '0' },
    { DATABASE_URL: databaseUrl, PORT: '65536' },
    { DATABASE_URL: databaseUrl, DATABASE_POOL_MAX: '0' },
    { DATABASE_URL: databaseUrl, NODE_ENV: 'staging' },
    { DATABASE_URL: databaseUrl, DATABASE_QUERY_TIMEOUT_MS: '0' },
    { DATABASE_URL: databaseUrl, WORKER_HEALTH_INTERVAL_MS: '10' },
  ])(
    'rejects invalid configuration without starting services: %j',
    (environment) => {
      expect(() => loadConfig(environment)).toThrow('Invalid configuration');
    },
  );

  it('does not include secret values in validation errors', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'secret-value-invalid-url' }),
    ).toThrow('DATABASE_URL');
    try {
      loadConfig({ DATABASE_URL: 'secret-value-invalid-url' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });
});
