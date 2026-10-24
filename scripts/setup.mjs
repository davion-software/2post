import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertRuntime,
  hasCode,
  isMain,
  readEnvironment,
  reportFailure,
  root,
  run,
} from './lib/runtime.mjs';

/** @param {string} directory */
export async function ensureEnvironmentFile(directory = root) {
  try {
    await copyFile(
      resolve(directory, '.env.example'),
      resolve(directory, '.env'),
      constants.COPYFILE_EXCL,
    );
    return 'created';
  } catch (error) {
    if (hasCode(error, 'EEXIST')) return 'preserved';
    throw error;
  }
}

/** @param {NodeJS.ProcessEnv} env */
export async function ensureTestDatabase(env) {
  if (env.NODE_ENV === 'production')
    throw new Error('dev:setup requiere un entorno de desarrollo.');
  if (!env.DATABASE_URL || !env.TEST_DATABASE_URL)
    throw new Error('Configura DATABASE_URL y TEST_DATABASE_URL en .env.');
  let appUrl;
  let testUrl;
  try {
    appUrl = new URL(env.DATABASE_URL);
    testUrl = new URL(env.TEST_DATABASE_URL);
  } catch {
    throw new Error('Las URLs de PostgreSQL no son válidas.');
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (
    !localHosts.includes(appUrl.hostname) ||
    !localHosts.includes(testUrl.hostname) ||
    appUrl.host !== testUrl.host ||
    appUrl.pathname === testUrl.pathname
  ) {
    throw new Error(
      'dev:setup solo prepara PostgreSQL local con bases de aplicación y pruebas distintas en el mismo servidor.',
    );
  }
  const name = decodeURIComponent(testUrl.pathname.slice(1));
  if (!name || Buffer.byteLength(name) > 63)
    throw new Error('El nombre de la base de pruebas no es válido.');
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 3000,
  });
  try {
    const found = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (found.rowCount === 0) {
      try {
        await pool.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
      } catch (error) {
        if (!hasCode(error, '42P04'))
          throw new Error(
            'No se pudo crear la base de pruebas local. Comprueba los permisos.',
            { cause: error },
          );
      }
    }
  } finally {
    await pool.end();
  }
}

export async function setup() {
  await assertRuntime();
  console.log(`.env: ${await ensureEnvironmentFile()}`);
  await run('pnpm', ['install', '--frozen-lockfile']);
  const env = await readEnvironment();
  await run('docker', ['compose', 'up', '-d', '--wait', 'postgres'], { env });
  await ensureTestDatabase(env);
  await run('pnpm', ['db:migrate'], { env });
  console.log('Entorno preparado. Ejecuta pnpm dev:doctor y pnpm dev.');
}

if (isMain(import.meta.url)) setup().catch(reportFailure);
