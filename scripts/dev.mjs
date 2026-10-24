import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { doctor } from './doctor.mjs';
import {
  assertRuntime,
  isMain,
  readEnvironment,
  reportFailure,
  root,
  run,
} from './lib/runtime.mjs';

export async function develop() {
  await assertRuntime();
  await run('pnpm', ['build']);
  if (!(await doctor()))
    throw new Error('Corrige los errores de dev:doctor antes de arrancar.');
  const env = await readEnvironment();
  const commands = [
    {
      name: 'build',
      args: [
        'node_modules/typescript/bin/tsc',
        '--project',
        'tsconfig.build.json',
        '--watch',
        '--preserveWatchOutput',
      ],
    },
    { name: 'api', args: ['--watch', 'dist/entrypoints/api.js'] },
    { name: 'worker', args: ['--watch', 'dist/entrypoints/worker.js'] },
  ];
  /** @type {import('node:child_process').ChildProcess[]} */
  const children = [];
  let stopping = false;
  /** @param {number} exitCode */
  async function stop(exitCode) {
    if (stopping) return;
    stopping = true;
    process.exitCode = exitCode;
    const exited = children.map(async (child) => {
      if (!child.pid) return;
      const done =
        child.exitCode !== null || child.signalCode !== null
          ? Promise.resolve()
          : once(child, 'exit');
      // Los grupos incluyen los hijos que crea node --watch y el compilador.
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          /* El grupo ya terminó. */
        }
      }
      return done;
    });
    const kill = setTimeout(() => {
      for (const child of children) {
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            /* El grupo ya terminó. */
          }
        }
      }
    }, 5000);
    kill.unref();
    await Promise.all(exited);
    clearTimeout(kill);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
  const interrupt = () => {
    stop(0).catch(reportFailure);
  };
  const terminate = () => {
    stop(0).catch(reportFailure);
  };
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  for (const command of commands) {
    const child = spawn(process.execPath, command.args, {
      cwd: root,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    console.log(`[${command.name}] watcher pid=${child.pid}`);
    for (const stream of [child.stdout, child.stderr]) {
      if (stream) {
        const lines = createInterface({ input: stream });
        lines.on('line', (line) => {
          console.log(`[${command.name}] ${line}`);
          if (line.includes('startup failed')) stop(1).catch(reportFailure);
        });
      }
    }
    child.once('error', () => {
      stop(1).catch(reportFailure);
    });
    child.once('exit', () => {
      if (!stopping)
        console.error(
          `[${command.name}] El proceso terminó; cerrando el entorno.`,
        );
      stop(stopping ? (process.exitCode === 1 ? 1 : 0) : 1).catch(
        reportFailure,
      );
    });
  }
}

if (isMain(import.meta.url)) develop().catch(reportFailure);
