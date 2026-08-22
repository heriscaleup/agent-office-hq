import { DATA_STATUSES } from '../agents/nadia/constants.mjs';

export class SerpProvider {
  async getStatus() {
    return {
      source: 'serp_provider',
      status: DATA_STATUSES.UNAVAILABLE,
      fetchedAt: new Date().toISOString(),
      error: 'No live competitor SERP provider is configured.'
    };
  }
}

