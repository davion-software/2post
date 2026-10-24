import { defineConfig } from 'drizzle-kit';

// generate trabaja sobre archivos y no necesita credenciales de base de datos.
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  strict: true,
});
