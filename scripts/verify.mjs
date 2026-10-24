import {
  assertRuntime,
  isMain,
  readEnvironment,
  reportFailure,
  run,
} from './lib/runtime.mjs';

export async function verify() {
  await assertRuntime();
  const env = await readEnvironment();
  await run('pnpm', ['check'], { env });
  await run('pnpm', ['tooling:check'], { env });
  await run('pnpm', ['exec', 'vp', 'test', '--project', 'integration'], {
    env,
  });
  await run('pnpm', ['db:check'], { env });
  await run('pnpm', ['secrets:check', '--self-test'], { env });
}

if (isMain(import.meta.url)) verify().catch(reportFailure);
