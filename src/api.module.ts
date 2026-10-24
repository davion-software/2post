import { Module, type DynamicModule } from '@nestjs/common';
import type { AppConfig } from './config/environment.js';
import { RuntimeModule } from './config/runtime.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import type { AppLogger } from './observability/app-logger.js';

@Module({})
export class ApiModule {
  static register(config: AppConfig, logger: AppLogger): DynamicModule {
    return {
      module: ApiModule,
      imports: [RuntimeModule.register(config, logger), OperationsModule],
    };
  }
}
