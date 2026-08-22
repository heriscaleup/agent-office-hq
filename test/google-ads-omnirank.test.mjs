import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { NadiaAgent } from '../agents/nadia/agent.mjs';
import { DATA_STATUSES } from '../agents/nadia/constants.mjs';
import { calculateOpportunityScore } from '../agents/nadia/scoring.mjs';
import {
  GoogleAdsSource,
  ManualGoogleAdsProvider,
  OmniRankGoogleAdsProvider,
  readOmniRankGoogleAdsConfig
} from '../tools/google_ads.mjs';
import { SearchConsoleProvider } from '../tools/search_console.mjs';

const FIXTURE = JSON.parse(fs.readFileSync(new URL('../contracts/omnirank-google-ads-search-terms-v1.fixture.json', import.meta.url), 'utf8'));
const ENV = Object.freeze({
  NODE_ENV: 'test',
  OMNIRANK_BASE_URL: 'https://omnirank.example.test',
  OMNIRANK_AGENT_SHARED_SECRET: 'test-agent-secret',
  NADIA_GOOGLE_ADS_CUSTOMER_ID: '123-456-7890',
  NADIA_GOOGLE_ADS_LOOKBACK_DAYS: '7',
  NADIA_MAX_GOOGLE_ADS_ROWS: '10000'
});

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

function liveFetcher(calls = []) {
  return async (url, options) => {
    calls.push({ url: String(url), options });
    return response(structuredClone(FIXTURE));
  };
}

class MemoryPersistence {
  constructor() { this.opportunities = []; this.tasks = []; this.runs = []; }
  async replaceOpportunities(records) { this.opportunities = records; }
  async appendSeoTask(task) { this.tasks.push(task); return task; }
  async appendAnalysisRun(run) { this.runs.push(run); return run; }
  async readOpportunities() { return this.opportunities; }
  async readSeoTasks() { return this.tasks; }
  async readAnalysisRuns() { return this.runs; }
}

test('OmniRank config distinguishes missing, partial, full, and invalid settings', () => {
  assert.equal(readOmniRankGoogleAdsConfig({ NODE_ENV: 'test' }).state, 'NONE');
  assert.equal(readOmniRankGoogleAdsConfig({ NODE_ENV: 'test', OMNIRANK_BASE_URL: 'https://example.test' }).state, 'PARTIAL');
  assert.equal(readOmniRankGoogleAdsConfig(ENV).state, 'FULL');
  assert.equal(readOmniRankGoogleAdsConfig({ ...ENV, OMNIRANK_BASE_URL: 'file:///etc/passwd' }).state, 'INVALID');
  assert.equal(readOmniRankGoogleAdsConfig(ENV).customerId, '1234567890');
});

test('OmniRank LIVE contract normalizes numeric evidence and never exposes the shared secret', async () => {
  const calls = [];
  const provider = new OmniRankGoogleAdsProvider({ env: ENV, fetcher: liveFetcher(calls) });
  const result = await provider.loadSearchTerms();
  assert.equal(result.status, DATA_STATUSES.LIVE);
  assert.equal(result.source, 'google_ads_via_omnirank');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].cost, 930000);
  assert.equal(result.items[0].avgCpc, 24473);
  assert.equal(result.items[0].conversions, 0);
  assert.equal(result.items[0].costScoringCompatible, true);
  assert.match(calls[0].url, /\/api\/ads\/search-terms\?days=7&customerId=1234567890/);
  assert.equal(calls[0].options.headers['x-omnirank-agent-secret'], 'test-agent-secret');
  assert.doesNotMatch(JSON.stringify(result), /test-agent-secret|authorization|refresh.?token|developer.?token/i);
});

test('LIVE success does not invoke manual fallback, including a valid empty LIVE dataset', async () => {
  let manualCalls = 0;
  const liveProvider = { loadSearchTerms: async () => ({ source: 'google_ads_via_omnirank', status: 'LIVE', items: [], fetchedAt: FIXTURE.provider.fetchedAt }) };
  const manualProvider = { loadSearchTerms: async () => { manualCalls += 1; return { status: 'MANUAL', items: [{}] }; } };
  const result = await new GoogleAdsSource({ liveProvider, manualProvider }).loadSearchTerms();
  assert.equal(result.status, 'LIVE');
  assert.equal(result.items.length, 0);
  assert.equal(manualCalls, 0);
});

test('gateway failure falls back to MANUAL and both unavailable remains UNAVAILABLE', async () => {
  const unavailable = { loadSearchTerms: async () => ({ source: 'google_ads_via_omnirank', status: 'UNAVAILABLE', items: [], provider: { health: 'AUTH_ERROR', reasonCode: 'GATEWAY_UNAUTHORIZED' } }) };
  const manual = new ManualGoogleAdsProvider([{ search_term: 'jasa laser cutting', clicks: 2, conversions: 0 }]);
  const fallback = await new GoogleAdsSource({ liveProvider: unavailable, manualProvider: manual }).loadSearchTerms();
  assert.equal(fallback.status, 'MANUAL');
  assert.equal(fallback.fallbackFrom.reasonCode, 'GATEWAY_UNAUTHORIZED');
  assert.equal(fallback.items[0].conversions, 0);

  const none = await new GoogleAdsSource({ liveProvider: unavailable, manualProvider: new ManualGoogleAdsProvider([]) }).loadSearchTerms();
  assert.equal(none.status, 'UNAVAILABLE');
});

test('gateway auth, malformed JSON, and transient failures are isolated and bounded', async () => {
  const unauthorized = await new OmniRankGoogleAdsProvider({ env: ENV, fetcher: async () => response({ secret: 'must-not-leak' }, 403) }).loadSearchTerms();
  assert.equal(unauthorized.provider.reasonCode, 'GATEWAY_UNAUTHORIZED');
  assert.doesNotMatch(JSON.stringify(unauthorized), /must-not-leak|test-agent-secret/);

  const malformed = await new OmniRankGoogleAdsProvider({
    env: ENV,
    fetcher: async () => ({ ok: true, status: 200, async json() { throw new SyntaxError('secret body'); } })
  }).loadSearchTerms();
  assert.equal(malformed.provider.reasonCode, 'MALFORMED_GATEWAY_RESPONSE');

  let calls = 0;
  const transient = await new OmniRankGoogleAdsProvider({
    env: ENV,
    retries: 2,
    sleep: async () => {},
    fetcher: async () => { calls += 1; return response({ error: 'upstream' }, 500); }
  }).loadSearchTerms();
  assert.equal(calls, 3);
  assert.equal(transient.status, 'UNAVAILABLE');

  let timeoutCalls = 0;
  const timeout = await new OmniRankGoogleAdsProvider({
    env: ENV,
    retries: 2,
    sleep: async () => {},
    fetcher: async () => { timeoutCalls += 1; const error = new Error('secret timeout'); error.name = 'AbortError'; throw error; }
  }).loadSearchTerms();
  assert.equal(timeoutCalls, 3);
  assert.equal(timeout.provider.reasonCode, 'GATEWAY_TIMEOUT');
  assert.doesNotMatch(JSON.stringify(timeout), /secret timeout/);
});

test('local row guard and non-IDR currency prevent misleading cost-pressure scoring', async () => {
  const payload = structuredClone(FIXTURE);
  payload.provider.currencyCode = 'USD';
  payload.data = [
    { ...structuredClone(payload.data[0]), currencyCode: 'USD' },
    { ...structuredClone(payload.data[0]), searchTerm: 'harga laser cutting', currencyCode: 'USD' }
  ];
  const provider = new OmniRankGoogleAdsProvider({
    env: { ...ENV, NADIA_MAX_GOOGLE_ADS_ROWS: '1' },
    fetcher: async () => response(payload)
  });
  const result = await provider.loadSearchTerms();
  assert.equal(result.items.length, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.provider.health, 'DEGRADED');
  assert.equal(result.items[0].costScoringCompatible, false);

  const score = calculateOpportunityScore({
    intent: 'COMMERCIAL', businessRelevance: 96,
    ads: { clicks: 38, cost: 930000, avgCpc: 24473, conversions: 0, currencyCode: 'USD', costScoringCompatible: false },
    gsc: { impressions: 1250, position: 12.4 }
  });
  assert.equal(score.components.paidCostPressure, 0);
  assert.equal(score.componentDetails.paidCostPressure.input.costScoringCompatible, false);
});

test('full Nadia pipeline consumes mocked LIVE Ads, GSC evidence, and DERIVED analysis', async () => {
  const adsProvider = new OmniRankGoogleAdsProvider({ env: ENV, fetcher: liveFetcher() });
  const persistence = new MemoryPersistence();
  const gscProviderFactory = () => new SearchConsoleProvider({
    configured: true,
    sites: [{ key: 'test', domain: 'example.com', env: 'UNUSED', defaultUrl: 'https://example.com/' }],
    queryMetrics: async () => ({
      found: true, clicks: 32, impressions: 1250, ctr: 0.0256, position: 12.4,
      rankingPages: [{ url: 'https://example.com/stainless', clicks: 32, impressions: 1250, ctr: 0.0256, position: 12.4 }],
      dateRange: FIXTURE.dateRange
    }),
    now: () => FIXTURE.provider.fetchedAt
  });
  const agent = new NadiaAgent({ persistence, googleAdsProvider: adsProvider, legacySearchTerms: [], gscProviderFactory });
  const result = await agent.analyze();
  assert.equal(result.status, 'success');
  assert.equal(result.run.sources[0].source, 'google_ads_via_omnirank');
  assert.equal(result.run.sources[0].status, 'LIVE');
  assert.equal(result.opportunities.length, 1);
  const opportunity = result.opportunities[0];
  assert.equal(opportunity.ads.status, 'LIVE');
  assert.equal(opportunity.ads.conversions, 0);
  assert.ok(['HIGH_PRIORITY', 'SEO_EXPERIMENT'].includes(opportunity.classification));
  assert.ok(opportunity.evidence.some(item => item.source === 'google_ads_via_omnirank' && item.status === 'LIVE'));
  assert.ok(opportunity.evidence.some(item => item.type === 'DERIVED_ANALYSIS' && item.status === 'DERIVED'));
});

test('status object contains provider health but no configuration secrets', async () => {
  const provider = new OmniRankGoogleAdsProvider({ env: ENV, fetcher: liveFetcher() });
  await provider.loadSearchTerms();
  const status = provider.getStatus();
  assert.equal(status.status, 'LIVE');
  assert.equal(status.gateway, 'OMNIRANK');
  assert.equal(status.searchCampaigns, 'LIVE');
  assert.equal(status.performanceMax, 'LIVE');
  assert.doesNotMatch(JSON.stringify(status), /test-agent-secret|OMNIRANK_AGENT_SHARED_SECRET/);
});

test('AI HQ connector and deployment never request duplicated Google OAuth credentials', () => {
  const connector = fs.readFileSync(new URL('../tools/google_ads.mjs', import.meta.url), 'utf8');
  const deployment = fs.readFileSync(new URL('../.github/workflows/deploy-vps.yml', import.meta.url), 'utf8');
  const forbidden = /GOOGLE_ADS_(?:CLIENT_ID|CLIENT_SECRET|REFRESH_TOKEN|DEVELOPER_TOKEN|LOGIN_CUSTOMER_ID)/;
  assert.doesNotMatch(connector, forbidden);
  assert.doesNotMatch(deployment, forbidden);
  assert.match(deployment, /OMNIRANK_AGENT_SHARED_SECRET/);
});
