import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ApiModule } from '../api.module.js';
import { AppConfig, loadConfig } from '../config/environment.js';
import { AppLogger } from '../observability/app-logger.js';

export async function createApiApplication(
  config: AppConfig = loadConfig(),
): Promise<NestFastifyApplication> {
  const logger = new AppLogger(config, 'api');
  const adapter = new FastifyAdapter({
    logger: false,
    bodyLimit: 1024 * 1024,
    requestTimeout: 30000,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    trustProxy: false,
  });
  const server = adapter.getInstance();
  server.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  server.addHook('onResponse', async (request, reply) => {
    logger.request(
      request.id,
      request.method,
      request.routeOptions.url ?? '(unmatched)',
      reply.statusCode,
      reply.elapsedTime,
    );
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    ApiModule.register(config, logger),
    adapter,
    { logger, abortOnError: false },
  );
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  return app;
}
