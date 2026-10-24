import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppConfig, loadConfig } from '../config/environment.js';
import { AppLogger } from '../observability/app-logger.js';
import { WorkerModule } from '../worker.module.js';
import { WorkerService } from '../worker/worker.service.js';

export async function createWorkerApplication(
  config: AppConfig = loadConfig(),
) {
  const logger = new AppLogger(config, 'worker');
  const app = await NestFactory.createApplicationContext(
    WorkerModule.register(config, logger),
    { logger, abortOnError: false },
  );
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  try {
    await app.get(WorkerService).start();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
