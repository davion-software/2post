import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../adapters/postgres/database.module.js';
import { DatabaseService } from '../../adapters/postgres/database.service.js';
import { CheckReadiness } from '../../application/check-readiness.js';
import { HealthController } from '../../interfaces/rest/health.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    {
      provide: CheckReadiness,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) => new CheckReadiness(database),
    },
  ],
})
export class OperationsModule {}
