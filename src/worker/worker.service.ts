import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../adapters/postgres/database.service.js';
import { AppConfig } from '../config/environment.js';
import { AppLogger } from '../observability/app-logger.js';

@Injectable()
export class WorkerService implements OnModuleDestroy {
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  async start(): Promise<void> {
    await this.database.ping();
    this.heartbeat = setInterval(() => {
      void this.database
        .ping()
        .catch(() => this.logger.error('Worker database check failed'));
    }, this.config.values.WORKER_HEALTH_INTERVAL_MS);
    this.logger.log('Worker started; no job handlers registered', 'Worker');
  }

  onModuleDestroy(): void {
    clearInterval(this.heartbeat);
  }
}
