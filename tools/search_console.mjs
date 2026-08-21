import { DATA_STATUSES, GSC_SITES } from '../agents/nadia/constants.mjs';
import { isConfigured, queryKeywordMetrics } from '../search_console.mjs';

function emptyMetrics(status, fetchedAt, error = null) {
  return {
    clicks: 0,
    impressions: 0,
    ctr: null,
    position: null,
    rankingUrls: [],
    dateRange: null,
    source: 'google_search_console',
    status,
    fetchedAt,
    error,
    queryEvidence: []
  };
}

function aggregateQueryResults(query, results, status, fetchedAt) {
  const successful = results.filter(result => !result.error);
  const rankingUrls = successful.flatMap(result => result.metrics.rankingPages.map(page => ({
    ...page,
    domain: result.site.domain,
    siteUrl: result.site.siteUrl
  }))).sort((a, b) => a.position - b.position);
  const clicks = successful.reduce((sum, result) => sum + result.metrics.clicks, 0);
  const impressions = successful.reduce((sum, result) => sum + result.metrics.impressions, 0);
  const weightedPosition = impressions
    ? successful.reduce((sum, result) => sum + result.metrics.position * result.metrics.impressions, 0) / impressions
    : null;
  const dateRange = successful.find(result => result.metrics.dateRange)?.metrics.dateRange || null;
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : null,
    position: weightedPosition == null ? null : Math.round(weightedPosition * 10) / 10,
    rankingUrls,
    dateRange,
    source: 'google_search_console',
    status: successful.length ? status : DATA_STATUSES.UNAVAILABLE,
    fetchedAt,
    error: successful.length ? null : results.map(result => result.error).filter(Boolean).join('; ') || 'No GSC data available.',
    queryEvidence: [{
      query,
      clicks,
      impressions,
      position: weightedPosition == null ? null : Math.round(weightedPosition * 10) / 10,
      rankingUrls,
      source: 'google_search_console',
      status: successful.length ? status : DATA_STATUSES.UNAVAILABLE,
      fetchedAt,
      dateRange
    }]
  };
}

export class SearchConsoleProvider {
  constructor({ cachedSnapshot = null } = {}) {
    this.cachedSnapshot = cachedSnapshot;
    this.lastStatus = cachedSnapshot?.lastAuditTimestamp ? DATA_STATUSES.CACHED : DATA_STATUSES.UNAVAILABLE;
  }

  sourceStatus() {
    return this.lastStatus;
  }

  loadCachedQuery(query) {
    const cached = this.cachedSnapshot?.queries?.[query.toLowerCase()];
    if (!cached) return null;
    this.lastStatus = DATA_STATUSES.CACHED;
    return {
      ...emptyMetrics(DATA_STATUSES.CACHED, cached.checkedAt || this.cachedSnapshot.lastAuditTimestamp),
      ...cached,
      rankingUrls: cached.rankingUrls || [],
      source: 'google_search_console',
      status: DATA_STATUSES.CACHED,
      fetchedAt: cached.checkedAt || this.cachedSnapshot.lastAuditTimestamp,
      queryEvidence: [{ query, ...cached, source: 'google_search_console', status: DATA_STATUSES.CACHED, fetchedAt: cached.checkedAt || this.cachedSnapshot.lastAuditTimestamp }]
    };
  }

  async loadQuery(query) {
    const fetchedAt = new Date().toISOString();
    if (isConfigured()) {
      const results = [];
      for (const site of GSC_SITES) {
        const siteUrl = process.env[site.env] || site.defaultUrl;
        try {
          results.push({ site: { ...site, siteUrl }, metrics: await queryKeywordMetrics(siteUrl, query), error: null });
        } catch (error) {
          results.push({ site: { ...site, siteUrl }, metrics: null, error: `${site.domain}: ${error.message}` });
        }
      }
      const aggregate = aggregateQueryResults(query, results, DATA_STATUSES.LIVE, fetchedAt);
      if (aggregate.status === DATA_STATUSES.LIVE) {
        this.lastStatus = DATA_STATUSES.LIVE;
        return aggregate;
      }
      const cachedFallback = this.loadCachedQuery(query);
      if (cachedFallback) return cachedFallback;
      return aggregate;
    }

    const cached = this.loadCachedQuery(query);
    if (cached) return cached;

    return emptyMetrics(DATA_STATUSES.UNAVAILABLE, fetchedAt, 'GSC credentials are not configured and no matching cache record exists.');
  }

  async loadCluster(queries) {
    const queryResults = [];
    for (const query of queries) queryResults.push(await this.loadQuery(query));
    const available = queryResults.filter(result => result.status !== DATA_STATUSES.UNAVAILABLE);
    if (!available.length) return emptyMetrics(DATA_STATUSES.UNAVAILABLE, new Date().toISOString(), 'No GSC evidence for this cluster.');

    const clicks = available.reduce((sum, item) => sum + item.clicks, 0);
    const impressions = available.reduce((sum, item) => sum + item.impressions, 0);
    const rankingUrlsByUrl = new Map();
    for (const result of available) {
      for (const page of result.rankingUrls) {
        const existing = rankingUrlsByUrl.get(page.url);
        if (!existing) rankingUrlsByUrl.set(page.url, { ...page });
        else {
          const combinedImpressions = existing.impressions + page.impressions;
          existing.position = combinedImpressions
            ? ((existing.position * existing.impressions) + (page.position * page.impressions)) / combinedImpressions
            : Math.min(existing.position, page.position);
          existing.clicks += page.clicks;
          existing.impressions = combinedImpressions;
          existing.ctr = combinedImpressions ? existing.clicks / combinedImpressions : null;
        }
      }
    }
    const rankingUrls = [...rankingUrlsByUrl.values()].sort((a, b) => a.position - b.position);
    const weightedPosition = impressions
      ? available.reduce((sum, item) => sum + (item.position || 0) * item.impressions, 0) / impressions
      : null;

    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : null,
      position: weightedPosition == null ? null : Math.round(weightedPosition * 10) / 10,
      rankingUrls,
      dateRange: available.find(item => item.dateRange)?.dateRange || null,
      source: 'google_search_console',
      status: available.some(item => item.status === DATA_STATUSES.LIVE) ? DATA_STATUSES.LIVE : DATA_STATUSES.CACHED,
      fetchedAt: new Date().toISOString(),
      error: null,
      queryEvidence: queryResults.flatMap(item => item.queryEvidence || [])
    };
  }
}
