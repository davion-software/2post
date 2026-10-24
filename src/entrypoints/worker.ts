import { createWorkerApplication } from '../bootstrap/worker.js';

void createWorkerApplication().catch(() => {
  console.error(
    'Worker startup failed. Check configuration and database availability.',
  );
  process.exitCode = 1;
});
