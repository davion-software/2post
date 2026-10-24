import type { LoggerService } from '@nestjs/common';
import pino, { type DestinationStream, type Logger } from 'pino';
import type { AppConfig } from '../config/environment.js';

export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(
    config: AppConfig,
    service: 'api' | 'worker' | 'migrate',
    destination?: DestinationStream,
  ) {
    const options: pino.LoggerOptions = {
      level: config.values.LOG_LEVEL,
      base: { service: `2post-${service}` },
      redact: {
        paths: [
          'password',
          'token',
          'secret',
          'authorization',
          'databaseUrl',
          '*.password',
          '*.token',
          '*.secret',
        ],
        censor: '[REDACTED]',
      },
    };
    this.logger = destination ? pino(options, destination) : pino(options);
  }

  log(message: unknown, context?: string): void {
    this.logger.info(
      { context },
      typeof message === 'string' ? message : 'Application event',
    );
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(
      { context },
      typeof message === 'string' ? message : 'Application warning',
    );
  }

  error(_message: unknown, ..._details: unknown[]): void {
    // Excepciones de drivers/proveedores pueden incluir secretos o datos del usuario.
    this.logger.error('Application error');
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(
      { context },
      typeof message === 'string' ? message : 'Application event',
    );
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace(
      { context },
      typeof message === 'string' ? message : 'Application event',
    );
  }

  request(
    requestId: string,
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    // Solo el patrón de ruta; nunca URL, query, headers o body de la solicitud.
    this.logger.info(
      { requestId, method, route, statusCode, durationMs },
      'HTTP request',
    );
  }
}
