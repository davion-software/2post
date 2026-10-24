import { Global, Module, type DynamicModule } from '@nestjs/common';
import { AppLogger } from '../observability/app-logger.js';
import { AppConfig } from './environment.js';

@Global()
@Module({})
export class RuntimeModule {
  static register(config: AppConfig, logger: AppLogger): DynamicModule {
    return {
      module: RuntimeModule,
      providers: [
        { provide: AppConfig, useValue: config },
        { provide: AppLogger, useValue: logger },
      ],
      exports: [AppConfig, AppLogger],
    };
  }
}
