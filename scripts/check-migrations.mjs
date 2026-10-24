import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { assertRuntime, isMain, reportFailure, root } from './lib/runtime.mjs';

/** @param {string} schema */
export async function checkMigrations(schema = './db/schema.ts') {
  await assertRuntime();
  const temp = await mkdtemp(resolve(tmpdir(), '2post-schema-'));
  try {
    const out = resolve(temp, 'migrations');
    await cp(resolve(root, 'db/migrations'), out, { recursive: true });
    const before = await readFile(resolve(out, 'meta/_journal.json'), 'utf8');
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'drizzle-kit',
        'generate',
        '--dialect=postgresql',
        `--schema=${relative(root, resolve(root, schema))}`,
        `--out=${relative(root, out)}`,
        '--name=drift_check',
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    );
    const after = await readFile(resolve(out, 'meta/_journal.json'), 'utf8');
    if (before !== after)
      throw new Error(
        'El esquema cambió sin migración. Ejecuta pnpm db:generate y revisa el SQL.',
      );
    // Drizzle Kit 0.31 puede devolver 0 tras un error interno. Exigir su
    // confirmación evita confundir ese caso con un esquema sin cambios.
    if (
      result.error ||
      result.status !== 0 ||
      !result.stdout.includes('No schema changes')
    ) {
      throw new Error(
        'Drizzle no confirmó la coherencia del esquema. Revisa pnpm db:generate.',
      );
    }
    const journal = JSON.parse(after);
    const files = new Set(await readdir(out));
    for (const entry of journal.entries) {
      if (!files.has(`${entry.tag}.sql`))
        throw new Error('Falta SQL de una entrada del journal de migraciones.');
    }
    console.log('Esquema y migraciones coherentes.');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) checkMigrations().catch(reportFailure);
