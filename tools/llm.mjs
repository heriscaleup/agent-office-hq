import { DATA_STATUSES } from '../agents/nadia/constants.mjs';

export class LLMProvider {
  constructor(name = 'none') {
    this.name = name;
  }

  async explain() {
    return {
      source: `llm:${this.name}`,
      status: DATA_STATUSES.UNAVAILABLE,
      fetchedAt: new Date().toISOString(),
      text: null,
      error: 'No LLM provider is configured; deterministic reasoning is active.'
    };
  }
}

