import { createRequire } from 'node:module';

// Usar el loader nativo de Node para que Vitest no cree copias de tokens DI
// al transformar un import ESM mientras Nest resuelve dependencias CommonJS.
const requireCompiled = createRequire(import.meta.url);

export const { createApiApplication } = requireCompiled(
  '../../dist/bootstrap/api.js',
) as typeof import('../../dist/bootstrap/api.js');
export const { createWorkerApplication } = requireCompiled(
  '../../dist/bootstrap/worker.js',
) as typeof import('../../dist/bootstrap/worker.js');
export const { DatabaseService } = requireCompiled(
  '../../dist/adapters/postgres/database.service.js',
) as typeof import('../../dist/adapters/postgres/database.service.js');
export const { runMigrations } = requireCompiled(
  '../../dist/adapters/postgres/migrate.js',
) as typeof import('../../dist/adapters/postgres/migrate.js');
export const { loadConfig } = requireCompiled(
  '../../dist/config/environment.js',
) as typeof import('../../dist/config/environment.js');
export const { AppLogger } = requireCompiled(
  '../../dist/observability/app-logger.js',
) as typeof import('../../dist/observability/app-logger.js');
