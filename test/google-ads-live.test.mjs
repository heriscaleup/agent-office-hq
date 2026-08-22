import assert from 'node:assert/strict';
import test from 'node:test';

import { NadiaAgent } from '../agents/nadia/agent.mjs';
import { DATA_STATUSES } from '../agents/nadia/constants.mjs';
import { calculateOpportunityScore } from '../agents/nadia/scoring.mjs';
import {
  GoogleAdsProvider,
  GoogleAdsSource,
  ManualGoogleAdsProvider,
  buildPerformanceMaxGaql,
  buildSearchTermsGaql,
  microsToCurrency,
  normalizeCustomerId,
  readGoogleAdsConfig
} from '../tools/google_ads.mjs';
import { SearchConsoleProvider } from '../tools/search_console.mjs';

const FULL_ENV = Object.freeze({
  GOOGLE_ADS_DEVELOPER_TOKEN: 'test-developer-token',
  GOOGLE_ADS_CLIENT_ID: 'test-client-id',
  GOOGLE_ADS_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_ADS_REFRESH_TOKEN: 'test-refresh-token',
  GOOGLE_ADS_CUSTOMER_ID: '123-456-7890',
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: '987-654-3210',
  GOOGLE_ADS_API_VERSION: 'v25',
  NADIA_GOOGLE_ADS_LOOKBACK_DAYS: '90'
});

const FIXED_NOW = new Date('2026-08-22T06:00:00.000Z');

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function stream(rows) {
  return [{ results: rows }];
}

function searchRow(overrides = {}) {
  return {
    searchTermView: { searchTerm: 'jasa laser cutting stainless tangerang', status: 'ADDED' },
    campaign: { id: '123', name: 'Laser Cutting Search', advertisingChannelType: 'SEARCH' },
    adGroup: { id: '456', name: 'Stainless' },
    metrics: {
      impressions: '420', clicks: '38', costMicros: '930000000000', averageCpc: '24473000000',
      ctr: 0.090476, conversions: 0, conversionsValue: 0
    },
    segments: { searchTermMatchSource: 'ADVERTISER_PROVIDED_KEYWORD' },
    ...overrides
  };
}

function pmaxRow() {
  return {
    campaignSearchTermView: { searchTerm: 'laser cutting custom plat' },
    campaign: { id: '789', name: 'PMax Laser', advertisingChannelType: 'PERFORMANCE_MAX' },
    metrics: {
      impressions: '100', clicks: '7', costMicros: '175000000000', averageCpc: '25000000000',
      ctr: 0.07, conversions: 1, conversionsValue: 500000
    },
    segments: { searchTermMatchSource: 'PERFORMANCE_MAX' }
  };
}

function successfulFetch({ currencyCode = 'IDR', pmaxRows = [pmaxRow()], capture = [] } = {}) {
  return async (url, options = {}) => {
    capture.push({ url: String(url), options });
    if (String(url).includes('oauth2.googleapis.com')) {
      return jsonResponse({ access_token: 'memory-only-access-token', expires_in: 3600 });
    }
    const query = JSON.parse(options.body).query;
    if (query.includes('FROM customer')) {
      return jsonResponse(stream([{ customer: { currencyCode, timeZone: 'Asia/Jakarta' } }]), 200, { 'request-id': 'metadata-request' });
    }
    if (query.includes('FROM search_term_view')) return jsonResponse(stream([searchRow()]), 200, { 'request-id': 'search-request' });
    if (query.includes('FROM campaign_search_term_view')) return jsonResponse(stream(pmaxRows), 200, { 'request-id': 'pmax-request' });
    throw new Error('Unexpected test query');
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

test('Google Ads config distinguishes none, partial, and full without exposing values', async () => {
  assert.equal(readGoogleAdsConfig({}).configurationState, 'NONE');
  assert.equal(readGoogleAdsConfig({ GOOGLE_ADS_CLIENT_ID: 'only-one' }).configurationState, 'PARTIAL');
  const full = readGoogleAdsConfig(FULL_ENV);
  assert.equal(full.configurationState, 'FULL');
  assert.equal(full.valid, true);
  assert.equal(normalizeCustomerId('123-456-7890'), '1234567890');

  let calls = 0;
  const missing = new GoogleAdsProvider({ env: {}, fetchImpl: async () => { calls += 1; } });
  assert.equal((await missing.loadSearchTerms()).status, DATA_STATUSES.UNAVAILABLE);
  assert.equal(missing.getStatus().reasonCode, 'MISSING_CREDENTIALS');
  const partial = new GoogleAdsProvider({ env: { GOOGLE_ADS_CLIENT_ID: 'only-one' }, fetchImpl: async () => { calls += 1; } });
  assert.equal((await partial.loadSearchTerms()).reasonCode, 'PARTIAL_CONFIG');
  assert.equal(calls, 0);
});

test('final GAQL separates Search and PMax without keyword segments in PMax', () => {
  const range = { startDate: '2026-05-25', endDate: '2026-08-22' };
  const search = buildSearchTermsGaql(range);
  const pmax = buildPerformanceMaxGaql(range);
  assert.match(search, /FROM search_term_view/);
  assert.match(search, /ad_group\.id/);
  assert.match(search, /campaign\.advertising_channel_type = 'SEARCH'/);
  assert.match(pmax, /FROM campaign_search_term_view/);
  assert.match(pmax, /search_term_match_source = 'PERFORMANCE_MAX'/);
  assert.doesNotMatch(pmax, /ad_group|keyword/i);
});

test('live provider refreshes OAuth in memory and normalizes Search and PMax rows', async () => {
  const capture = [];
  const provider = new GoogleAdsProvider({
    env: FULL_ENV, fetchImpl: successfulFetch({ capture }), now: () => new Date(FIXED_NOW), sleep: async () => {}
  });
  const result = await provider.loadSearchTerms();
  assert.equal(result.status, DATA_STATUSES.LIVE);
  assert.equal(result.health, 'READY');
  assert.equal(result.items.length, 2);
  assert.equal(result.dateRange.startDate, '2026-05-25');
  assert.equal(result.dateRange.endDate, '2026-08-22');
  const search = result.items.find(item => item.campaignType === 'SEARCH');
  assert.equal(search.searchTerm, 'jasa laser cutting stainless tangerang');
  assert.equal(search.campaignId, '123');
  assert.equal(search.adGroupId, '456');
  assert.equal(search.cost, 930000);
  assert.equal(search.avgCpc, 24473);
  assert.equal(search.conversions, 0);
  assert.equal(search.status, DATA_STATUSES.LIVE);
  assert.equal(search.currencyCode, 'IDR');
  const pmax = result.items.find(item => item.campaignType === 'PERFORMANCE_MAX');
  assert.equal(pmax.matchSource, 'PERFORMANCE_MAX');
  assert.equal(pmax.adGroup, null);

  const oauthCalls = capture.filter(call => call.url.includes('oauth2.googleapis.com'));
  assert.equal(oauthCalls.length, 1);
  const apiCalls = capture.filter(call => call.url.includes('googleads.googleapis.com'));
  assert.ok(apiCalls.every(call => call.url.includes('/v25/customers/1234567890/')));
  assert.ok(apiCalls.every(call => call.options.headers['login-customer-id'] === '9876543210'));
  assert.ok(apiCalls.every(call => call.options.headers.authorization === 'Bearer memory-only-access-token'));
  assert.doesNotMatch(JSON.stringify(result), /memory-only-access-token|test-client-secret|test-refresh-token/);
  assert.doesNotMatch(JSON.stringify(provider.getStatus()), /memory-only-access-token|test-client-secret|test-refresh-token/);
  assert.equal(microsToCurrency(930000000), 930);
  assert.equal(microsToCurrency(930000000000), 930000);
});

test('login-customer-id header is omitted without manager account configuration', async () => {
  const capture = [];
  const env = { ...FULL_ENV };
  delete env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  const provider = new GoogleAdsProvider({ env, fetchImpl: successfulFetch({ capture }), now: () => new Date(FIXED_NOW) });
  await provider.loadSearchTerms();
  const apiCalls = capture.filter(call => call.url.includes('googleads.googleapis.com'));
  assert.ok(apiCalls.every(call => !Object.hasOwn(call.options.headers, 'login-customer-id')));
});

test('OAuth token is cached only until its refresh window', async () => {
  let clock = new Date(FIXED_NOW);
  let oauthCalls = 0;
  const provider = new GoogleAdsProvider({
    env: FULL_ENV,
    now: () => new Date(clock),
    fetchImpl: async url => {
      assert.ok(String(url).includes('oauth2.googleapis.com'));
      oauthCalls += 1;
      return jsonResponse({ access_token: `token-${oauthCalls}`, expires_in: 3600 });
    }
  });
  assert.equal(await provider.getAccessToken(), 'token-1');
  assert.equal(await provider.getAccessToken(), 'token-1');
  clock = new Date(FIXED_NOW.getTime() + 3_550_000);
  assert.equal(await provider.getAccessToken(), 'token-2');
  assert.equal(oauthCalls, 2);
});

test('PMax failure keeps successful Search data LIVE but marks provider DEGRADED', async () => {
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes('oauth2.googleapis.com')) return jsonResponse({ access_token: 'token', expires_in: 3600 });
    const query = JSON.parse(options.body).query;
    if (query.includes('FROM customer')) return jsonResponse(stream([{ customer: { currencyCode: 'IDR', timeZone: 'UTC' } }]));
    if (query.includes('FROM search_term_view')) return jsonResponse(stream([searchRow()]));
    return jsonResponse({ error: { message: 'sanitized by provider' } }, 500, { 'request-id': 'pmax-failed' });
  };
  const provider = new GoogleAdsProvider({ env: FULL_ENV, fetchImpl, now: () => new Date(FIXED_NOW), maxRetries: 0 });
  const result = await provider.loadSearchTerms();
  assert.equal(result.status, DATA_STATUSES.LIVE);
  assert.equal(result.health, 'DEGRADED');
  assert.equal(result.subSources.searchCampaigns, DATA_STATUSES.LIVE);
  assert.equal(result.subSources.performanceMax, DATA_STATUSES.UNAVAILABLE);
  assert.equal(result.items.length, 1);
  assert.equal(result.warnings.find(item => item.scope === 'performanceMax').requestId, 'pmax-failed');
});

test('live/manual fallback preserves exclusive and honest provenance', async () => {
  let manualCalls = 0;
  const manual = new ManualGoogleAdsProvider([{ search_term: 'manual term', clicks: 1 }]);
  const originalManualLoad = manual.loadSearchTerms.bind(manual);
  manual.loadSearchTerms = async () => { manualCalls += 1; return originalManualLoad(); };
  const liveSource = new GoogleAdsSource({
    liveProvider: { loadSearchTerms: async () => ({ source: 'google_ads', status: DATA_STATUSES.LIVE, items: [] }) },
    manualProvider: manual
  });
  assert.equal((await liveSource.loadSearchTerms()).status, DATA_STATUSES.LIVE);
  assert.equal(manualCalls, 0);

  const unavailableLive = { loadSearchTerms: async () => ({ source: 'google_ads', status: DATA_STATUSES.UNAVAILABLE,
    health: 'API_ERROR', reasonCode: 'AUTHORIZATION_ERROR', items: [] }) };
  const fallback = await new GoogleAdsSource({ liveProvider: unavailableLive, manualProvider: manual }).loadSearchTerms();
  assert.equal(fallback.status, DATA_STATUSES.MANUAL);
  assert.equal(fallback.fallbackFrom.reasonCode, 'AUTHORIZATION_ERROR');
  const neither = await new GoogleAdsSource({ liveProvider: unavailableLive, manualProvider: new ManualGoogleAdsProvider([]) }).loadSearchTerms();
  assert.equal(neither.status, DATA_STATUSES.UNAVAILABLE);
  assert.equal(neither.source, 'google_ads');
  assert.equal(neither.manualFallback.status, DATA_STATUSES.UNAVAILABLE);
});

test('HTTP failures are sanitized and transient retries are bounded', async () => {
  for (const status of [401, 403]) {
    let apiCalls = 0;
    const provider = new GoogleAdsProvider({ env: FULL_ENV, maxRetries: 2, sleep: async () => {}, fetchImpl: async url => {
      if (String(url).includes('oauth2.googleapis.com')) return jsonResponse({ access_token: 'secret-token', expires_in: 3600 });
      apiCalls += 1;
      return jsonResponse({ error: { message: 'must never escape' } }, status, { 'request-id': `request-${status}` });
    } });
    await assert.rejects(provider.runGaql('SELECT customer.id FROM customer'), error => {
      assert.equal(error.httpStatus, status);
      assert.equal(error.requestId, `request-${status}`);
      assert.doesNotMatch(error.message, /secret-token|must never escape/);
      return true;
    });
    assert.equal(apiCalls, 1);
  }

  for (const status of [429, 500]) {
    let apiCalls = 0;
    const provider = new GoogleAdsProvider({ env: FULL_ENV, maxRetries: 2, sleep: async () => {}, fetchImpl: async url => {
      if (String(url).includes('oauth2.googleapis.com')) return jsonResponse({ access_token: 'token', expires_in: 3600 });
      apiCalls += 1;
      return jsonResponse({}, status);
    } });
    await assert.rejects(provider.runGaql('SELECT customer.id FROM customer'));
    assert.equal(apiCalls, 3);
  }
});

test('network timeout and malformed stream response do not crash the provider', async () => {
  const timeoutProvider = new GoogleAdsProvider({ env: FULL_ENV, timeoutMs: 5, maxRetries: 0,
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes('oauth2.googleapis.com')) return jsonResponse({ access_token: 'token', expires_in: 3600 });
      return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    } });
  await assert.rejects(timeoutProvider.runGaql('SELECT customer.id FROM customer'), { code: 'TIMEOUT' });

  const malformedProvider = new GoogleAdsProvider({ env: FULL_ENV, maxRetries: 0, fetchImpl: async url => {
    if (String(url).includes('oauth2.googleapis.com')) return jsonResponse({ access_token: 'token', expires_in: 3600 });
    return jsonResponse({ not: 'a SearchStream array' });
  } });
  await assert.rejects(malformedProvider.runGaql('SELECT customer.id FROM customer'), { code: 'MALFORMED_RESPONSE' });
});

test('oversized SearchStream response is cancelled before unbounded buffering', async () => {
  const provider = new GoogleAdsProvider({
    env: FULL_ENV,
    maxRetries: 0,
    maxResponseBytes: 64,
    fetchImpl: async url => {
      if (String(url).includes('oauth2.googleapis.com')) {
        return jsonResponse({ access_token: 'token', expires_in: 3600 });
      }
      return jsonResponse([{ results: [{ oversized: 'x'.repeat(200) }] }]);
    }
  });
  await assert.rejects(provider.runGaql('SELECT customer.id FROM customer'), { code: 'RESPONSE_TOO_LARGE' });
});

test('row limit trims safely and non-IDR currency disables cost pressure scoring', async () => {
  const env = { ...FULL_ENV, NADIA_MAX_GOOGLE_ADS_ROWS: '1' };
  const provider = new GoogleAdsProvider({ env, fetchImpl: successfulFetch({ currencyCode: 'USD' }), now: () => new Date(FIXED_NOW) });
  const result = await provider.loadSearchTerms();
  assert.equal(result.status, DATA_STATUSES.LIVE);
  assert.equal(result.truncated, true);
  assert.equal(result.rowsReceived, 2);
  assert.equal(result.rowsProcessed, 1);
  assert.equal(result.items[0].currencyCode, 'USD');
  assert.equal(result.items[0].costScoringCompatible, false);
  assert.equal(result.health, 'DEGRADED');
  const score = calculateOpportunityScore({
    intent: 'COMMERCIAL', businessRelevance: 100,
    ads: { ...result.items[0] },
    gsc: { impressions: 1000, position: 12 }
  });
  assert.equal(score.components.paidCostPressure, 0);
  assert.equal(score.componentDetails.paidCostPressure.input.costScoringCompatible, false);
});

test('full Nadia pipeline uses LIVE Ads evidence and preserves zero-conversion opportunity', async () => {
  const liveProvider = new GoogleAdsProvider({ env: FULL_ENV, fetchImpl: successfulFetch({ pmaxRows: [] }), now: () => new Date(FIXED_NOW) });
  const persistence = new MemoryPersistence();
  const agent = new NadiaAgent({
    persistence,
    legacySearchTerms: [{ search_term: 'manual should not be used', clicks: 999 }],
    googleAdsProvider: liveProvider,
    gscProviderFactory: () => new SearchConsoleProvider({
      configured: true,
      sites: [{ key: 'test', domain: 'example.com', env: 'UNUSED', defaultUrl: 'https://example.com/' }],
      queryMetrics: async () => ({ found: true, clicks: 32, impressions: 1250, ctr: 0.0256, position: 12.4,
        rankingPages: [{ page: 'https://example.com/stainless', clicks: 32, impressions: 1250, ctr: 0.0256, position: 12.4 }],
        dateRange: { startDate: '2026-07-20', endDate: '2026-08-18' } })
    })
  });
  const analysis = await agent.analyze();
  assert.equal(analysis.status, 'success');
  assert.equal(analysis.run.sources[0].source, 'google_ads');
  assert.equal(analysis.run.sources[0].status, DATA_STATUSES.LIVE);
  const opportunity = analysis.opportunities.find(item => item.primaryKeyword === 'jasa laser cutting stainless tangerang');
  assert.ok(opportunity);
  assert.equal(opportunity.ads.status, DATA_STATUSES.LIVE);
  assert.equal(opportunity.ads.conversions, 0);
  assert.ok(['HIGH_PRIORITY', 'SEO_EXPERIMENT'].includes(opportunity.classification));
  assert.ok(opportunity.evidence.some(item => item.type === 'PAID_SEARCH_TERM' && item.status === DATA_STATUSES.LIVE));
  assert.ok(opportunity.evidence.some(item => item.type === 'GSC_QUERY' && item.status === DATA_STATUSES.LIVE));
  assert.ok(opportunity.evidence.some(item => item.type === 'DERIVED_ANALYSIS' && item.status === DATA_STATUSES.DERIVED));
  assert.ok(!analysis.opportunities.some(item => item.primaryKeyword === 'manual should not be used'));
});
