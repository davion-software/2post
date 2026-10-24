import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { hasCode, isMain, reportFailure, root, run } from './lib/runtime.mjs';

/** @param {boolean} selfTest */
export async function checkSecrets(selfTest = false) {
  const snapshot = await mkdtemp(resolve(tmpdir(), '2post-secrets-'));
  try {
    // Incluye archivos nuevos y versionados, respeta .gitignore y analiza los bytes actuales.
    const files = new Set(
      execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: root, encoding: 'utf8' },
      )
        .split('\0')
        .filter(Boolean),
    );
    for (const file of files) {
      if (/^\.env(?:\.|$)/.test(file) && file !== '.env.example') {
        throw new Error(
          'Hay un archivo .env versionado. Retíralo del índice y conserva solo .env.example.',
        );
      }
      const source = resolve(root, file);
      let stat;
      try {
        stat = await lstat(source);
      } catch (error) {
        if (hasCode(error, 'ENOENT')) continue;
        throw new Error(
          'No se pudo leer un archivo durante el escaneo de secretos.',
          { cause: error },
        );
      }
      if (!stat.isFile()) continue;
      const target = resolve(snapshot, file);
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
    }
    const args = [
      'run',
      '--rm',
      '-v',
      `${snapshot}:/repo:ro`,
      'ghcr.io/gitleaks/gitleaks:v8.30.1',
      'dir',
      '/repo',
      '--config=/repo/.gitleaks.toml',
      '--redact',
      '--verbose',
      '--no-banner',
    ];
    await run('docker', args);
    if (selfTest) {
      const dummy = randomBytes(32).toString('base64url');
      await writeFile(
        resolve(snapshot, '__scanner_probe__.txt'),
        `api_key = "${dummy}"\n`,
      );
      const result = spawnSync('docker', args, {
        encoding: 'utf8',
        timeout: 30000,
      });
      const output = result.stdout + result.stderr;
      if (
        result.status !== 1 ||
        !output.includes('generic-api-key') ||
        output.includes(dummy)
      ) {
        throw new Error(
          'El escáner no detectó u ocultó correctamente la credencial ficticia de prueba.',
        );
      }
      console.log(
        'Correcto: Gitleaks detectó la credencial ficticia y ocultó su valor.',
      );
    }
  } finally {
    await rm(snapshot, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url))
  checkSecrets(process.argv.includes('--self-test')).catch(reportFailure);
