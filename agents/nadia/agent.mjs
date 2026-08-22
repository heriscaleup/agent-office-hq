import crypto from 'crypto';
import { SEARCH_TERMS_VAULT_DATA, getGscCacheSnapshot } from '../../serp_auditor.mjs';
import { GoogleAdsProvider, GoogleAdsSource, ManualGoogleAdsProvider } from '../../tools/google_ads.mjs';
import { SearchConsoleProvider } from '../../tools/search_console.mjs';
import { SerpProvider } from '../../tools/serp.mjs';
import { LLMProvider } from '../../tools/llm.mjs';
import { clusterSearchTerms } from './clustering.mjs';
import { CLASSIFICATIONS, DATA_STATUSES, NADIA_DENIED_CAPABILITIES, NADIA_PERMISSIONS } from './constants.mjs';
import { calculateBusinessRelevance, classifyIntent } from './intent.mjs';
import { buildOpportunity } from './opportunity.mjs';
import { NadiaPersistence } from './persistence.mjs';
import { buildSeoTask } from './task_builder.mjs';

export const NADIA_IDENTITY = Object.freeze({
  id: 'radar-x',
  name: 'Nadia',
  version: '1.1.0',
  role: 'SEO Intelligence Agent',
  goal: 'Convert paid-inefficient but relevant demand into evidence-backed organic opportunities and proposed SEO tasks.',
  mode: 'DETERMINISTIC_RULE_ENGINE',
  permissions: NADIA_PERMISSIONS,
  deniedCapabilities: NADIA_DENIED_CAPABILITIES
});

function createRunId(startedAt) {
  const stamp = startedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NADIA-${stamp}-${suffix}`;
}

function sourceRecord(source, status, fetchedAt, details = {}) {
  return { source, status, fetchedAt, ...details };
}

export class NadiaAgent {
  constructor({
    persistence = new NadiaPersistence(),
    legacySearchTerms = SEARCH_TERMS_VAULT_DATA,
    gscProviderFactory = null,
    googleAdsProvider = new GoogleAdsProvider()
  } = {}) {
    this.persistence = persistence;
    this.legacySearchTerms = legacySearchTerms;
    this.gscProviderFactory = gscProviderFactory;
    this.googleAdsProvider = googleAdsProvider;
    this.serpProvider = new SerpProvider();
    this.llmProvider = new LLMProvider();
  }

  createGoogleAdsSource(manualSearchTerms) {
    const manualRecords = Array.isArray(manualSearchTerms) ? manualSearchTerms : this.legacySearchTerms;
    return new GoogleAdsSource({
      liveProvider: this.googleAdsProvider,
      manualProvider: new ManualGoogleAdsProvider(manualRecords)
    });
  }

  createGscProvider() {
    const cachedSnapshot = getGscCacheSnapshot();
    return this.gscProviderFactory
      ? this.gscProviderFactory({ cachedSnapshot })
      : new SearchConsoleProvider({ cachedSnapshot });
  }

  async analyze({ manualSearchTerms } = {}) {
    const startedAt = new Date().toISOString();
    const runId = createRunId(startedAt);
    const errors = [];
    let adsResult;
    let opportunities = [];
    let clusters = [];
    const gscProvider = this.createGscProvider();

    try {
      adsResult = await this.createGoogleAdsSource(manualSearchTerms).loadSearchTerms();
      const analyzedTerms = adsResult.items.map(item => ({
        ...item,
        intent: classifyIntent(item.searchTerm),
        businessRelevance: calculateBusinessRelevance(item.searchTerm)
      }));
      clusters = clusterSearchTerms(analyzedTerms);

      for (const cluster of clusters) {
        const gsc = await gscProvider.loadCluster([cluster.primaryKeyword, ...cluster.supportingQueries]);
        if (gsc.error && gsc.status === DATA_STATUSES.UNAVAILABLE) errors.push({ scope: cluster.primaryKeyword, message: gsc.error });
        opportunities.push(buildOpportunity(cluster, gsc));
      }

      for (const warning of gscProvider.getWarnings()) {
        errors.push({ scope: 'google_search_console', message: warning });
      }

      opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore || a.primaryKeyword.localeCompare(b.primaryKeyword));
      await this.persistence.replaceOpportunities(opportunities);
    } catch (error) {
      errors.push({ scope: 'analysis', message: error.message });
    }

    const finishedAt = new Date().toISOString();
    const serpStatus = await this.serpProvider.getStatus();
    const llmStatus = await this.llmProvider.explain();
    const gscSummary = gscProvider.sourceSummary();
    const sources = [
      sourceRecord(adsResult?.source || 'google_ads_via_omnirank', adsResult?.status || DATA_STATUSES.UNAVAILABLE, adsResult?.fetchedAt || finishedAt, {
        error: adsResult?.error || null,
        provider: adsResult?.provider || null,
        fallbackFrom: adsResult?.fallbackFrom || null,
        rowsLoaded: adsResult?.items?.length || 0,
        dateRange: adsResult?.dateRange || null
      }),
      sourceRecord(gscSummary.source, gscSummary.status, gscSummary.fetchedAt || finishedAt, {
        requestStats: gscProvider.getStats()
      }),
      sourceRecord(serpStatus.source, serpStatus.status, serpStatus.fetchedAt, { error: serpStatus.error }),
      sourceRecord(llmStatus.source, llmStatus.status, llmStatus.fetchedAt, { error: llmStatus.error })
    ];
    const run = {
      runId,
      startedAt,
      finishedAt,
      sources,
      searchTermsProcessed: adsResult?.items?.length || 0,
      clustersCreated: clusters.length,
      opportunitiesCreated: opportunities.length,
      highPriority: opportunities.filter(item => item.classification === CLASSIFICATIONS.HIGH_PRIORITY).length,
      tasksCreated: 0,
      gscRequestStats: gscProvider.getStats(),
      errors
    };
    await this.persistence.appendAnalysisRun(run);

    return {
      status: errors.some(error => error.scope === 'analysis') ? 'error' : 'success',
      agent: NADIA_IDENTITY,
      run,
      opportunities
    };
  }

  async getOpportunities({ classification, minScore = 0, limit = 100 } = {}) {
    const records = await this.persistence.readOpportunities();
    return records
      .filter(item => !classification || item.classification === classification)
      .filter(item => item.opportunityScore >= Number(minScore || 0))
      .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
  }

  async createTask(opportunityId) {
    const opportunity = (await this.persistence.readOpportunities()).find(item => item.id === opportunityId);
    if (!opportunity) {
      const error = new Error('Opportunity not found.');
      error.code = 'OPPORTUNITY_NOT_FOUND';
      throw error;
    }
    if (opportunity.classification === CLASSIFICATIONS.DISCARD) {
      const error = new Error('DISCARD opportunities cannot create Maya tasks.');
      error.code = 'OPPORTUNITY_DISCARDED';
      throw error;
    }
    return this.persistence.appendSeoTask(buildSeoTask(opportunity));
  }

  async getStatus() {
    const [opportunities, tasks, runs] = await Promise.all([
      this.persistence.readOpportunities(),
      this.persistence.readSeoTasks(),
      this.persistence.readAnalysisRuns()
    ]);
    const lastRun = runs.at(-1) || null;
    const gscSummary = this.createGscProvider().sourceSummary();
    const currentStatus = !lastRun
      ? 'NOT_ANALYZED'
      : lastRun.errors.some(error => error.scope === 'analysis')
        ? 'ERROR'
        : lastRun.errors.length ? 'DEGRADED' : 'READY';
    return {
      agent: NADIA_IDENTITY,
      currentStatus,
      lastAnalysis: lastRun?.finishedAt || null,
      dataSources: lastRun?.sources || [
        sourceRecord('google_ads_via_omnirank', DATA_STATUSES.UNAVAILABLE, new Date().toISOString(), {
          provider: this.googleAdsProvider.getStatus()
        }),
        sourceRecord('google_ads_search_terms_manual', this.legacySearchTerms.length ? DATA_STATUSES.MANUAL : DATA_STATUSES.UNAVAILABLE, new Date().toISOString()),
        sourceRecord('google_search_console', gscSummary.status, gscSummary.fetchedAt || new Date().toISOString()),
        sourceRecord('serp_provider', DATA_STATUSES.UNAVAILABLE, new Date().toISOString()),
        sourceRecord('llm:none', DATA_STATUSES.UNAVAILABLE, new Date().toISOString())
      ],
      opportunities: opportunities.length,
      highPriority: opportunities.filter(item => item.classification === CLASSIFICATIONS.HIGH_PRIORITY).length,
      tasksProposed: tasks.filter(item => item.status === 'PROPOSED').length,
      lastRun
    };
  }

  async getGoogleAdsStatus() {
    return this.googleAdsProvider.getStatus();
  }

  async answer(message) {
    const status = await this.getStatus();
    const opportunities = await this.getOpportunities({ limit: 5 });
    const lower = String(message || '').toLowerCase();
    let reply;

    if (!status.lastAnalysis) {
      reply = 'Belum ada analysis run tersimpan. Jalankan Nadia Analyze agar saya dapat menjawab dari evidence. Google Ads via OmniRank akan dicoba terlebih dahulu; fallback legacy selalu diberi label MANUAL.';
    } else if (lower.includes('source') || lower.includes('sumber') || lower.includes('data')) {
      reply = status.dataSources.map(item => `${item.source}: ${item.status} (${item.fetchedAt})`).join('\n');
    } else {
      reply = opportunities.length
        ? opportunities.map(item => `${item.id} | ${item.primaryKeyword} | score ${item.opportunityScore} | ${item.classification} | Ads ${item.ads.status} | GSC ${item.gsc.status}`).join('\n')
        : 'Analysis run tersedia, tetapi tidak menghasilkan opportunity.';
    }

    return {
      status: 'success',
      agentId: NADIA_IDENTITY.id,
      agentName: NADIA_IDENTITY.name,
      agentAvatar: '👩‍💻',
      agentColor: '#ffe600',
      timestamp: new Date().toLocaleTimeString('id-ID'),
      reply,
      evidence: opportunities.flatMap(item => item.evidence).slice(0, 10)
    };
  }
}

export const nadiaAgent = new NadiaAgent();
