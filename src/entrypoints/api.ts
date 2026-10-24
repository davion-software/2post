import { createApiApplication } from '../bootstrap/api.js';
import { loadConfig } from '../config/environment.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApiApplication(config);
  try {
    await app.listen(config.values.PORT, config.values.HOST);
  } catch (error) {
    await app.close();
    throw error;
  }
}

void main().catch(() => {
  console.error(
    'API startup failed. Check configuration and service availability.',
  );
  process.exitCode = 1;
});
