import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { NadiaAgent } from '../agents/nadia/agent.mjs';
import { clusterSearchTerms } from '../agents/nadia/clustering.mjs';
import {
  CLASSIFICATIONS,
  DATA_STATUSES,
  EXISTING_PAGE_STATUSES,
  RECOMMENDATIONS,
  SCORING_CALIBRATION
} from '../agents/nadia/constants.mjs';
import { calculateBusinessRelevance, classifyIntent, matchesIndicator } from '../agents/nadia/intent.mjs';
import { buildOpportunity } from '../agents/nadia/opportunity.mjs';
import { calculateOpportunityScore } from '../agents/nadia/scoring.mjs';
import { GoogleAdsProvider, ManualGoogleAdsProvider } from '../tools/google_ads.mjs';
import { SearchConsoleProvider } from '../tools/search_console.mjs';

const TEST_SITE = Object.freeze({
  key: 'test',
  domain: 'example.com',
  env: 'UNUSED_TEST_SITE_ENV',
  defaultUrl: 'https://example.com/'
});

function analyzedItem(searchTerm, overrides = {}) {
  return {
    searchTerm,
    campaign: 'test',
    adGroup: null,
    clicks: 5,
    impressions: 50,
    cost: 125000,
    avgCpc: 25000,
    conversions: 0,
    conversionValue: 0,
    businessRelevance: calculateBusinessRelevance(searchTerm),
    intent: classifyIntent(searchTerm),
    source: 'google_ads_search_terms_manual',
    status: DATA_STATUSES.MANUAL,
    fetchedAt: '2026-08-21T00:00:00.000Z',
    ...overrides
  };
}

function gscMetrics(overrides = {}) {
  return {
    clicks: 0,
    impressions: 0,
    ctr: null,
    position: null,
    rankingUrls: [],
    dateRange: null,
    source: 'google_search_console',
    status: DATA_STATUSES.UNAVAILABLE,
    fetchedAt: '2026-08-21T00:00:00.000Z',
    queryEvidence: [],
    ...overrides
  };
}

function emptyLiveMetrics() {
  return {
    found: false,
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: null,
    rankingPages: [],
    dateRange: { startDate: '2026-07-20', endDate: '2026-08-18' }
  };
}

class MemoryPersistence {
  constructor() {
    this.opportunities = [];
    this.tasks = [];
    this.runs = [];
  }

  async replaceOpportunities(records) { this.opportunities = records; }
  async appendSeoTask(task) { this.tasks.push(task); return task; }
  async appendAnalysisRun(run) { this.runs.push(run); return run; }
  async readOpportunities() { return this.opportunities; }
  async readSeoTasks() { return this.tasks; }
  async readAnalysisRuns() { return this.runs; }
}

test('provenance statuses distinguish source data from deterministic derivation', async () => {
  assert.equal(DATA_STATUSES.DERIVED, 'DERIVED');

  const manual = await new ManualGoogleAdsProvider([{
    search_term: 'jasa laser cutting',
    clicks: 1,
    date_range: { startDate: '2026-08-01', endDate: '2026-08-20' }
  }]).loadSearchTerms();
  assert.equal(manual.status, DATA_STATUSES.MANUAL);
  assert.equal(manual.items[0].status, DATA_STATUSES.MANUAL);
  assert.deepEqual(manual.dateRange, { startDate: '2026-08-01', endDate: '2026-08-20' });

  const missing = await new GoogleAdsProvider().loadSearchTerms();
  assert.equal(missing.status, DATA_STATUSES.UNAVAILABLE);
  const missingGsc = await new SearchConsoleProvider({ configured: false }).loadQuery('missing query');
  assert.equal(missingGsc.status, DATA_STATUSES.UNAVAILABLE);

  const cacheTimestamp = '2026-08-19T03:04:05.000Z';
  const cachedProvider = new SearchConsoleProvider({
    configured: false,
    cachedSnapshot: {
      lastAuditTimestamp: cacheTimestamp,
      queries: { 'cached query': { checkedAt: cacheTimestamp, clicks: 1, impressions: 10, ctr: 0.1, position: 12, rankingUrls: [] } }
    }
  });
  const cached = await cachedProvider.loadQuery('cached query');
  assert.equal(cached.status, DATA_STATUSES.CACHED);
  assert.equal(cached.fetchedAt, cacheTimestamp);

  const liveTimestamp = '2026-08-21T01:02:03.000Z';
  const liveProvider = new SearchConsoleProvider({
    configured: true,
    sites: [TEST_SITE],
    queryMetrics: async () => emptyLiveMetrics(),
    now: () => liveTimestamp
  });
  const live = await liveProvider.loadQuery('live query');
  assert.equal(live.status, DATA_STATUSES.LIVE);
  assert.equal(live.fetchedAt, liveTimestamp);

  const cluster = { cluster: 'Jasa Laser Cutting', primaryKeyword: 'jasa laser cutting', supportingQueries: [], items: [analyzedItem('jasa laser cutting')] };
  const opportunity = buildOpportunity(cluster, gscMetrics());
  const derived = opportunity.evidence.find(item => item.type === 'DERIVED_ANALYSIS');
  assert.equal(derived.status, DATA_STATUSES.DERIVED);
  assert.equal(derived.fetchedAt, opportunity.analyzedAt);
});

test('intent and relevance matching use token and phrase boundaries', () => {
  assert.equal(matchesIndicator('assessment laser', 'ss'), false);
  assert.equal(matchesIndicator('laser cutting ss', 'ss'), true);
  assert.equal(matchesIndicator('panduan jual mesin laser', 'jual mesin'), true);
  assert.equal(matchesIndicator('tepat laser tangerang', 'tepat laser'), true);
  assert.equal(calculateBusinessRelevance('assessment laser'), 20);
  assert.equal(classifyIntent('cooperator laser'), 'UNKNOWN');
});

test('steel and stainless remain separate materials while ss is token-normalized', () => {
  const clusters = clusterSearchTerms([
    analyzedItem('laser cutting steel'),
    analyzedItem('laser cutting stainless'),
    analyzedItem('laser cutting ss')
  ]);
  assert.equal(clusters.length, 2);
  const stainlessCluster = clusters.find(cluster => cluster.items.some(item => item.searchTerm === 'laser cutting stainless'));
  assert.ok(stainlessCluster.items.some(item => item.searchTerm === 'laser cutting ss'));
  assert.ok(!stainlessCluster.items.some(item => item.searchTerm === 'laser cutting steel'));
});

test('cluster membership stays coherent with the primary instead of chaining through a member', () => {
  const terms = [
    'alpha beta gamma delta',
    'alpha beta gamma delta epsilon zeta',
    'gamma delta epsilon zeta'
  ].map(searchTerm => analyzedItem(searchTerm, { businessRelevance: 50, clicks: 1, cost: 1 }));
  const clusters = clusterSearchTerms(terms);
  assert.equal(clusters.length, 2);
  assert.equal(clusters.find(cluster => cluster.primaryKeyword === 'alpha beta gamma delta').items.length, 2);
  assert.equal(clusters.find(cluster => cluster.primaryKeyword === 'gamma delta epsilon zeta').items.length, 1);
});

test('score remains calibrated, gated by semantics, and machine-readable', () => {
  assert.deepEqual(
    {
      clicks: SCORING_CALIBRATION.clicksForMaxPaidEvidence,
      cpc: SCORING_CALIBRATION.cpcForMaxCostPressure,
      cost: SCORING_CALIBRATION.costForMaxPressure,
      impressions: SCORING_CALIBRATION.impressionsForMaxDemand,
      conversions: SCORING_CALIBRATION.conversionsForMaxEvidence
    },
    { clicks: 20, cpc: 25000, cost: 1000000, impressions: 1000, conversions: 3 }
  );

  const employment = calculateOpportunityScore({
    intent: 'IRRELEVANT',
    businessRelevance: 0,
    ads: { clicks: 1000, cost: 50000000, avgCpc: 50000, conversions: 100 },
    gsc: { impressions: 100000, position: 8 }
  });
  assert.equal(employment.classification, CLASSIFICATIONS.DISCARD);

  const zeroConversion = calculateOpportunityScore({
    intent: 'COMMERCIAL',
    businessRelevance: 96,
    ads: { clicks: 38, cost: 930000, avgCpc: 24473, conversions: 0 },
    gsc: { impressions: 1250, position: 12.4 }
  });
  assert.ok([CLASSIFICATIONS.HIGH_PRIORITY, CLASSIFICATIONS.SEO_EXPERIMENT].includes(zeroConversion.classification));
  assert.equal(typeof zeroConversion.components.businessRelevance, 'number');
  assert.deepEqual(zeroConversion.componentDetails.paidTrafficEvidence.input, { clicks: 38 });
  assert.equal(zeroConversion.componentDetails.paidTrafficEvidence.max, 15);

  const informational = calculateOpportunityScore({
    intent: 'INFORMATIONAL',
    businessRelevance: 90,
    ads: { clicks: 10, cost: 200000, avgCpc: 10000, conversions: 0 },
    gsc: { impressions: 500, position: 25 }
  });
  assert.equal(informational.classification, CLASSIFICATIONS.SUPPORTING_CONTENT);
});

test('GSC request cache deduplicates normalized queries within one provider run', async () => {
  let calls = 0;
  const provider = new SearchConsoleProvider({
    configured: true,
    sites: [TEST_SITE],
    queryMetrics: async () => { calls += 1; return emptyLiveMetrics(); }
  });
  const [first, second] = await Promise.all([
    provider.loadQuery('Jasa   Laser Cutting'),
    provider.loadQuery('jasa laser cutting')
  ]);
  assert.equal(calls, 1);
  assert.strictEqual(first, second);
  assert.equal(provider.getStats().uniqueQueriesRequested, 1);
});

test('GSC outbound concurrency never exceeds the configured limit', async () => {
  let active = 0;
  let maximumActive = 0;
  let calls = 0;
  const sites = [0, 1, 2].map(index => ({ ...TEST_SITE, key: `site-${index}`, domain: `site-${index}.example.com` }));
  const provider = new SearchConsoleProvider({
    configured: true,
    sites,
    concurrency: 2,
    queryMetrics: async () => {
      calls += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await delay(15);
      active -= 1;
      return emptyLiveMetrics();
    }
  });
  await provider.loadCluster(['query one', 'query two', 'query three']);
  assert.equal(calls, 9);
  assert.ok(maximumActive <= 2, `maximum active requests was ${maximumActive}`);
  assert.equal(maximumActive, 2);
});

test('GSC max-query guard degrades an analysis without fabricating evidence', async () => {
  const persistence = new MemoryPersistence();
  const agent = new NadiaAgent({
    persistence,
    legacySearchTerms: [
      { search_term: 'jasa laser cutting stainless', clicks: 4, cost: 100000 },
      { search_term: 'inspirasi pagar laser', clicks: 3, cost: 50000 }
    ],
    gscProviderFactory: () => new SearchConsoleProvider({ configured: false, maxQueries: 1 })
  });
  const analysis = await agent.analyze();
  const status = await agent.getStatus();
  assert.equal(analysis.status, 'success');
  assert.equal(status.currentStatus, 'DEGRADED');
  assert.ok(analysis.run.errors.some(error => error.message.includes('NADIA_MAX_GSC_QUERIES')));
  assert.equal(analysis.run.gscRequestStats.uniqueQueriesRequested, 1);
  assert.ok(analysis.opportunities.every(opportunity => opportunity.gsc.status === DATA_STATUSES.UNAVAILABLE));
  assert.ok(analysis.opportunities.every(opportunity => opportunity.existingPageStatus === EXISTING_PAGE_STATUSES.UNKNOWN));
});

test('missing GSC evidence yields UNKNOWN existing-page state and never CREATE_NEW_PAGE', () => {
  const item = analyzedItem('jasa laser cutting stainless', {
    clicks: 38,
    cost: 930000,
    avgCpc: 24473,
    businessRelevance: 96,
    intent: 'COMMERCIAL'
  });
  const opportunity = buildOpportunity({
    cluster: 'Jasa Laser Cutting Stainless',
    primaryKeyword: item.searchTerm,
    supportingQueries: [],
    items: [item]
  }, gscMetrics());
  assert.equal(opportunity.existingPageStatus, EXISTING_PAGE_STATUSES.UNKNOWN);
  assert.equal(opportunity.existingPageFound, null);
  assert.equal(opportunity.cannibalization, null);
  assert.equal(opportunity.recommendation, RECOMMENDATIONS.MONITOR);
});

test('existing GSC page is optimized before any create-page recommendation', () => {
  const item = analyzedItem('inspirasi pagar laser cutting', {
    businessRelevance: 90,
    intent: 'INFORMATIONAL',
    clicks: 10,
    avgCpc: 10000
  });
  const opportunity = buildOpportunity({
    cluster: 'Inspirasi Pagar Laser Cutting',
    primaryKeyword: item.searchTerm,
    supportingQueries: [],
    items: [item]
  }, gscMetrics({
    status: DATA_STATUSES.LIVE,
    impressions: 500,
    position: 25,
    rankingUrls: [{ url: 'https://example.com/pagar', clicks: 2, impressions: 500, ctr: 0.004, position: 25 }]
  }));
  assert.equal(opportunity.existingPageStatus, EXISTING_PAGE_STATUSES.FOUND);
  assert.equal(opportunity.existingPageFound, true);
  assert.equal(opportunity.recommendation, RECOMMENDATIONS.OPTIMIZE_EXISTING);
});
