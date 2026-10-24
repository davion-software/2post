import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const root = fileURLToPath(new URL('../../', import.meta.url));

/** @param {unknown} error @param {string} code */
export function hasCode(error, code) {
  return error instanceof Error && 'code' in error && error.code === code;
}

/** @param {string} directory @param {NodeJS.ProcessEnv} overrides @returns {Promise<NodeJS.ProcessEnv>} */
export async function readEnvironment(
  directory = root,
  overrides = process.env,
) {
  try {
    return {
      ...parseEnv(await readFile(resolve(directory, '.env'), 'utf8')),
      ...overrides,
    };
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return { ...overrides };
    throw new Error('No se pudo leer .env. Comprueba los permisos.', {
      cause: error,
    });
  }
}

export async function assertRuntime() {
  const expected = (await readFile(resolve(root, '.nvmrc'), 'utf8')).trim();
  if (process.versions.node !== expected) {
    throw new Error(
      `Usa Node ${expected}; esta terminal usa ${process.versions.node}. Ejecuta nvm use en la raíz del proyecto.`,
    );
  }
  const manifest = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const actual = spawnSync('pnpm', ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (
    actual.status !== 0 ||
    `pnpm@${actual.stdout.trim()}` !== manifest.packageManager
  ) {
    throw new Error(`Usa ${manifest.packageManager}, fijado en package.json.`);
  }
}

/** @param {string} command @param {string[]} args @param {{cwd?: string, env?: NodeJS.ProcessEnv}} options */
export async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
  await new Promise((resolvePromise, reject) => {
    child.once('error', () =>
      reject(
        new Error(
          `No se pudo ejecutar ${command}. Comprueba que esté instalado.`,
        ),
      ),
    );
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise(undefined);
      else
        reject(
          new Error(`${command} terminó con ${signal ?? `código ${code}`}.`),
        );
    });
  });
}

/** @param {string} moduleUrl */
export function isMain(moduleUrl) {
  return (
    process.argv[1] !== undefined &&
    fileURLToPath(moduleUrl) === resolve(process.argv[1])
  );
}

/** @param {unknown} error */
export function reportFailure(error) {
  console.error(error instanceof Error ? error.message : 'La operación falló.');
  process.exitCode = 1;
}
