import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { assertRuntime, isMain, reportFailure, root } from './lib/runtime.mjs';
import { checkMigrations } from './check-migrations.mjs';

/** @param {{result: import('node:child_process').SpawnSyncReturns<string>, tool: 'lint' | 'layers' | 'modules', expected: string | null}} options */
function assertProbeResult({ result, tool, expected }) {
  const output = result.stdout + result.stderr;
  const expectedExit = expected ? 1 : 0;
  if (result.error || result.status !== expectedExit) {
    throw new Error(
      `La prueba ${tool}/${expected ?? 'válida'} falló: salida ${result.status}.\n${output}`,
    );
  }
  if (!expected) return;
  const found =
    tool === 'lint'
      ? output.includes(expected)
      : z
          .object({ [expected]: z.array(z.unknown()).min(1) })
          .safeParse(JSON.parse(result.stdout)).success;
  if (!found)
    throw new Error(`La prueba ${tool} no produjo el hallazgo ${expected}.`);
}

/** @param {Record<string, string>} files @param {'lint' | 'layers' | 'modules'} tool @param {string | null} expected */
async function probe(files, tool, expected) {
  const directory = await mkdtemp(resolve(tmpdir(), '2post-tooling-test-'));
  try {
    for (const file of [
      '.fallowrc.json',
      '.fallow-modules.json',
      'vite.config.ts',
      'tsconfig.json',
    ]) {
      await cp(resolve(root, file), resolve(directory, file));
    }
    await writeFile(
      resolve(directory, 'package.json'),
      JSON.stringify({
        name: 'tooling-fixture',
        type: 'commonjs',
        private: true,
      }),
    );
    await symlink(
      resolve(root, 'node_modules'),
      resolve(directory, 'node_modules'),
      'dir',
    );
    for (const [name, text] of Object.entries(files)) {
      const target = resolve(directory, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text);
    }
    const args =
      tool === 'lint'
        ? [resolve(root, 'node_modules/vite-plus/bin/vp'), 'lint', '.']
        : [
            resolve(root, 'node_modules/.bin/fallow'),
            ...(tool === 'modules' ? ['--config', '.fallow-modules.json'] : []),
            'architecture',
            '--format',
            'json',
            '--quiet',
          ];
    const result = spawnSync(
      tool === 'lint' ? process.execPath : (args.shift() ?? ''),
      args,
      { cwd: directory, encoding: 'utf8', timeout: 20000 },
    );
    assertProbeResult({ result, tool, expected });
    console.log(`Correcto: ${tool}/${expected ?? 'válida'}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function checkTooling() {
  await assertRuntime();
  await probe(
    {
      'src/application/run.ts':
        'export function run(): void { Promise.resolve(1); }',
    },
    'lint',
    'no-floating-promises',
  );
  await probe(
    {
      'src/application/run.ts':
        'export function run(): void { if (Promise.resolve(true)) console.log("incorrect"); }',
    },
    'lint',
    'no-misused-promises',
  );
  await probe(
    {
      'src/application/run.ts':
        'import { Injectable } from "@nestjs/common"; export const dependency = Injectable;',
    },
    'lint',
    'no-restricted-imports',
  );
  await probe(
    {
      'src/interfaces/rest/controller.ts':
        'import { storage } from "../../adapters/postgres/storage.js"; export const controller = storage;',
      'src/adapters/postgres/storage.ts': 'export const storage = 1;',
    },
    'layers',
    'boundary_violations',
  );
  await probe(
    { 'src/misplaced.ts': 'export const misplaced = 1;' },
    'layers',
    'boundary_coverage_violations',
  );
  await probe(
    {
      'src/application/a.ts':
        'import { b } from "./b.js"; export function a() { return b; }',
      'src/application/b.ts':
        'import { a } from "./a.js"; export function b() { return a; }',
    },
    'layers',
    'circular_dependencies',
  );
  await probe(
    {
      'src/modules/foo/application/run.ts':
        'import { internal } from "../../bar/application/internal.js"; export const run = internal;',
      'src/modules/bar/application/internal.ts': 'export const internal = 1;',
    },
    'modules',
    'boundary_violations',
  );
  await probe(
    {
      'src/modules/foo/application/run.ts':
        'import type { Contract } from "../../bar/bar.contracts.js"; export function run(value: Contract) { return value; }',
      'src/modules/bar/bar.contracts.ts':
        'export interface Contract { readonly value: string; }',
    },
    'modules',
    null,
  );
  await probe(
    {
      'src/modules/foo/foo.schema.ts':
        'import { id } from "../bar/bar.schema.js"; export const reference = id;',
      'src/modules/bar/bar.schema.ts': 'export const id = 1;',
    },
    'modules',
    null,
  );
  const schemaFixture = await mkdtemp(resolve(tmpdir(), '2post-drift-test-'));
  try {
    await symlink(
      resolve(root, 'node_modules'),
      resolve(schemaFixture, 'node_modules'),
      'dir',
    );
    const schema = resolve(schemaFixture, 'schema.ts');
    await writeFile(
      schema,
      `export * from ${JSON.stringify(resolve(root, 'db/schema.ts'))};\nimport { pgTable, text } from 'drizzle-orm/pg-core';\nexport const probe = pgTable('tooling_schema_probe', { value: text('value') });\n`,
    );
    let detected = false;
    try {
      await checkMigrations(schema);
    } catch (error) {
      detected =
        error instanceof Error && error.message.includes('sin migración');
    }
    if (!detected)
      throw new Error(
        'La comprobación de esquema no detectó una tabla sin migración.',
      );
    console.log(
      'Correcto: migración ausente detectada sin modificar el repositorio.',
    );
  } finally {
    await rm(schemaFixture, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) checkTooling().catch(reportFailure);
