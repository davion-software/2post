import type { DatabaseProbe } from '../../../application/ports/database-probe.js';

export type Readiness = {
  status: 'ok' | 'not_ready';
  checks: { database: 'up' | 'down' };
};

export class CheckReadiness {
  constructor(private readonly database: DatabaseProbe) {}

  async execute(): Promise<Readiness> {
    try {
      await this.database.ping();
      return { status: 'ok', checks: { database: 'up' } };
    } catch {
      return { status: 'not_ready', checks: { database: 'down' } };
    }
  }
}
