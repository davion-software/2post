import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CheckReadiness } from '../../application/check-readiness.js';

@Controller('health')
export class HealthController {
  constructor(private readonly checkReadiness: CheckReadiness) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready() {
    const result = await this.checkReadiness.execute();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
