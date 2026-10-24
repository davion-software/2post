import { Module, type DynamicModule } from '@nestjs/common';
import { DatabaseModule } from './adapters/postgres/database.module.js';
import type { AppConfig } from './config/environment.js';
import { RuntimeModule } from './config/runtime.module.js';
import type { AppLogger } from './observability/app-logger.js';
import { WorkerService } from './worker/worker.service.js';

@Module({})
export class WorkerModule {
  static register(config: AppConfig, logger: AppLogger): DynamicModule {
    return {
      module: WorkerModule,
      imports: [RuntimeModule.register(config, logger), DatabaseModule],
      providers: [WorkerService],
    };
  }
}
