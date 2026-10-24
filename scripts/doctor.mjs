import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import {
  assertRuntime,
  isMain,
  readEnvironment,
  reportFailure,
  root,
} from './lib/runtime.mjs';

/** @param {string} host @param {number} port */
export async function checkPort(host, port) {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () =>
      server.close((error) =>
        error ? reject(error) : resolvePromise(undefined),
      ),
    );
  });
}

/** @param {{json?: boolean, services?: boolean}} options */
export async function doctor({ json = false, services = true } = {}) {
  /** @type {{check: string, status: 'ok' | 'error', detail: string}[]} */
  const checks = [];
  /** @param {string} check @param {() => Promise<unknown>} action @param {string} detail */
  async function inspect(check, action, detail) {
    try {
      await action();
      checks.push({ check, status: 'ok', detail: 'Correcto' });
    } catch {
      checks.push({ check, status: 'error', detail });
    }
  }
  const expected = (await readFile(resolve(root, '.nvmrc'), 'utf8')).trim();
  await inspect(
    'runtime',
    assertRuntime,
    `Usa Node ${expected}; esta terminal usa ${process.versions.node}. Ejecuta nvm use y usa la versión de pnpm de package.json.`,
  );
  await inspect(
    'node-pins',
    async () => {
      if (
        (await readFile(resolve(root, '.node-version'), 'utf8')).trim() !==
        expected
      )
        throw new Error('Node pins differ');
    },
    'Alinea .nvmrc y .node-version.',
  );
  await inspect(
    'dependencies',
    () => access(resolve(root, 'node_modules/.bin/vp')),
    'Ejecuta pnpm install --frozen-lockfile.',
  );
  await inspect(
    'environment-file',
    () => access(resolve(root, '.env')),
    'Ejecuta pnpm dev:setup para crear .env sin sobrescribir uno existente.',
  );
  const env = await readEnvironment();
  const require = createRequire(import.meta.url);
  /** @type {import('../dist/config/environment.js').AppConfig | undefined} */
  let config;
  await inspect(
    'configuration',
    async () => {
      /** @type {typeof import('../dist/config/environment.js')} */
      const { loadConfig } = require('../dist/config/environment.js');
      config = loadConfig(env);
    },
    'Ejecuta pnpm build y comprueba las variables documentadas en .env.example.',
  );
  if (services) {
    await inspect(
      'docker',
      async () => {
        const result = spawnSync(
          'docker',
          ['info', '--format', '{{.ServerVersion}}'],
          { encoding: 'utf8', timeout: 5000 },
        );
        if (result.status !== 0) throw new Error('Docker unavailable');
        if (
          spawnSync('docker', ['compose', 'version'], { timeout: 5000 })
            .status !== 0
        )
          throw new Error('Compose unavailable');
      },
      'Inicia Docker y comprueba que Docker Compose esté instalado.',
    );
    if (config) {
      const values = config.values;
      await inspect(
        'api-port',
        () => checkPort(values.HOST, values.PORT),
        'El puerto de la API está ocupado o HOST no es válido. Detén el proceso existente o cambia PORT.',
      );
      for (const [name, url] of [
        ['database', env.DATABASE_URL],
        ['test-database', env.TEST_DATABASE_URL],
      ]) {
        await inspect(
          name ?? 'database',
          async () => {
            if (!url) throw new Error('Missing URL');
            if (
              name === 'test-database' &&
              new URL(url).pathname === new URL(env.DATABASE_URL ?? '').pathname
            )
              throw new Error('Shared database');
            const { Pool } = await import('pg');
            const pool = new Pool({
              connectionString: url,
              max: 1,
              connectionTimeoutMillis: 1500,
              query_timeout: 1500,
            });
            try {
              await pool.query('SELECT 1');
            } finally {
              await pool.end();
            }
          },
          'Ejecuta pnpm dev:setup y usa bases distintas en DATABASE_URL y TEST_DATABASE_URL.',
        );
      }
    }
  }
  if (json)
    console.log(
      JSON.stringify({
        ok: checks.every((check) => check.status === 'ok'),
        checks,
      }),
    );
  else
    for (const check of checks)
      console.log(`[${check.status}] ${check.check}: ${check.detail}`);
  return checks.every((check) => check.status === 'ok');
}

if (isMain(import.meta.url)) {
  doctor({
    json: process.argv.includes('--json'),
    services: !process.argv.includes('--no-services'),
  })
    .then((ok) => {
      if (!ok) process.exitCode = 1;
    })
    .catch(reportFailure);
}
