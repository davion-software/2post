import { Writable } from 'node:stream';
import { expect, it } from 'vite-plus/test';
import { loadConfig, AppLogger } from '../helpers/compiled.js';

it('does not serialize raw exceptions into application logs', () => {
  let output = '';
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  const logger = new AppLogger(
    loadConfig({
      DATABASE_URL: 'postgresql://user:password-secret@localhost/test',
    }),
    'api',
    destination,
  );
  logger.error(
    new Error('provider-token-secret'),
    'postgresql://user:password-secret@localhost/test',
  );
  logger.request('request-1', 'GET', '/health/live', 200, 5);
  expect(output).not.toContain('password-secret');
  expect(output).not.toContain('provider-token-secret');
  expect(output).toContain('request-1');
});
