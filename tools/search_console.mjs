import { DATA_STATUSES, GSC_REQUEST_RULES, GSC_SITES } from '../agents/nadia/constants.mjs';
import { isConfigured, queryKeywordMetrics } from '../search_console.mjs';

function normalizeQueryKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function configuredInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function latestTimestamp(records, fallback = null) {
  return records
    .map(record => record?.fetchedAt)
    .filter(value => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || fallback;
}

function emptyMetrics(status, fetchedAt, error = null, details = {}) {
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
    queryEvidence: [],
    ...details
  };
}

function aggregateQueryResults(query, results, status, fallbackFetchedAt) {
  const successful = results.filter(result => !result.error);
  const fetchedAt = latestTimestamp(successful, fallbackFetchedAt);
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
  const effectiveStatus = successful.length ? status : DATA_STATUSES.UNAVAILABLE;
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : null,
    position: weightedPosition == null ? null : Math.round(weightedPosition * 10) / 10,
    rankingUrls,
    dateRange,
    source: 'google_search_console',
    status: effectiveStatus,
    fetchedAt,
    error: successful.length ? null : results.map(result => result.error).filter(Boolean).join('; ') || 'No GSC data available.',
    queryEvidence: [{
      query,
      clicks,
      impressions,
      position: weightedPosition == null ? null : Math.round(weightedPosition * 10) / 10,
      rankingUrls,
      source: 'google_search_console',
      status: effectiveStatus,
      fetchedAt,
      dateRange
    }]
  };
}

class RequestLimiter {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];
  }

  run(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift();
      this.active += 1;
      Promise.resolve()
        .then(job.operation)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

const STATUS_PRIORITY = Object.freeze({
  [DATA_STATUSES.UNAVAILABLE]: 0,
  [DATA_STATUSES.CACHED]: 1,
  [DATA_STATUSES.LIVE]: 2
});

export class SearchConsoleProvider {
  constructor({
    cachedSnapshot = null,
    queryMetrics = queryKeywordMetrics,
    configured = isConfigured,
    sites = GSC_SITES,
    concurrency = configuredInteger(
      process.env.NADIA_GSC_CONCURRENCY,
      GSC_REQUEST_RULES.defaultConcurrency,
      GSC_REQUEST_RULES.maximumConcurrency
    ),
    maxQueries = configuredInteger(process.env.NADIA_MAX_GSC_QUERIES, GSC_REQUEST_RULES.defaultMaxQueries),
    now = () => new Date().toISOString()
  } = {}) {
    this.cachedSnapshot = cachedSnapshot;
    this.cachedQueriesByKey = new Map(
      Object.entries(cachedSnapshot?.queries || {}).map(([query, value]) => [normalizeQueryKey(query), value])
    );
    this.queryMetrics = queryMetrics;
    this.isConfigured = typeof configured === 'function' ? configured : () => Boolean(configured);
    this.sites = sites;
    this.concurrency = configuredInteger(concurrency, GSC_REQUEST_RULES.defaultConcurrency, GSC_REQUEST_RULES.maximumConcurrency);
    this.maxQueries = configuredInteger(maxQueries, GSC_REQUEST_RULES.defaultMaxQueries);
    this.now = now;
    this.limiter = new RequestLimiter(this.concurrency);
    this.queryCache = new Map();
    this.uniqueQueriesRequested = 0;
    this.warnings = [];
    this.lastStatus = cachedSnapshot?.lastAuditTimestamp ? DATA_STATUSES.CACHED : DATA_STATUSES.UNAVAILABLE;
    this.lastFetchedAt = cachedSnapshot?.lastAuditTimestamp || null;
  }

  updateSourceStatus(status, fetchedAt) {
    const nextPriority = STATUS_PRIORITY[status] ?? -1;
    const currentPriority = STATUS_PRIORITY[this.lastStatus] ?? -1;
    if (nextPriority > currentPriority) {
      this.lastStatus = status;
      if (fetchedAt) this.lastFetchedAt = fetchedAt;
    } else if (nextPriority === currentPriority && fetchedAt
      && (!this.lastFetchedAt || Date.parse(fetchedAt) > Date.parse(this.lastFetchedAt))) {
      this.lastFetchedAt = fetchedAt;
    }
  }

  sourceStatus() {
    return this.lastStatus;
  }

  sourceSummary() {
    return {
      source: 'google_search_console',
      status: this.lastStatus,
      fetchedAt: this.lastFetchedAt
    };
  }

  getWarnings() {
    return [...this.warnings];
  }

  getStats() {
    return {
      uniqueQueriesRequested: this.uniqueQueriesRequested,
      cachedQueryEntries: this.queryCache.size,
      maxQueries: this.maxQueries,
      concurrency: this.concurrency
    };
  }

  loadCachedQuery(query) {
    const key = normalizeQueryKey(query);
    const cached = this.cachedQueriesByKey.get(key);
    if (!cached) return null;
    const fetchedAt = cached.checkedAt || this.cachedSnapshot.lastAuditTimestamp;
    this.updateSourceStatus(DATA_STATUSES.CACHED, fetchedAt);
    return {
      ...emptyMetrics(DATA_STATUSES.CACHED, fetchedAt),
      ...cached,
      rankingUrls: cached.rankingUrls || [],
      source: 'google_search_console',
      status: DATA_STATUSES.CACHED,
      fetchedAt,
      queryEvidence: [{ query, ...cached, source: 'google_search_console', status: DATA_STATUSES.CACHED, fetchedAt }]
    };
  }

  loadQuery(query) {
    const normalizedQuery = normalizeQueryKey(query);
    if (!normalizedQuery) {
      return Promise.resolve(emptyMetrics(DATA_STATUSES.UNAVAILABLE, this.now(), 'GSC query is empty.'));
    }
    if (this.queryCache.has(normalizedQuery)) return this.queryCache.get(normalizedQuery);

    if (this.uniqueQueriesRequested >= this.maxQueries) {
      const warning = `NADIA_MAX_GSC_QUERIES limit reached (${this.maxQueries}); skipped query "${normalizedQuery}".`;
      if (!this.warnings.includes(warning)) this.warnings.push(warning);
      const limited = Promise.resolve(emptyMetrics(
        DATA_STATUSES.UNAVAILABLE,
        this.now(),
        warning,
        { limitExceeded: true }
      ));
      this.queryCache.set(normalizedQuery, limited);
      return limited;
    }

    this.uniqueQueriesRequested += 1;
    const pending = this.loadUniqueQuery(normalizedQuery);
    this.queryCache.set(normalizedQuery, pending);
    return pending;
  }

  async loadUniqueQuery(query) {
    if (this.isConfigured()) {
      const results = await Promise.all(this.sites.map(site => this.limiter.run(async () => {
        const siteUrl = process.env[site.env] || site.defaultUrl;
        try {
          const metrics = await this.queryMetrics(siteUrl, query);
          return { site: { ...site, siteUrl }, metrics, fetchedAt: this.now(), error: null };
        } catch (error) {
          return { site: { ...site, siteUrl }, metrics: null, fetchedAt: null, error: `${site.domain}: ${error.message}` };
        }
      })));
      const aggregate = aggregateQueryResults(query, results, DATA_STATUSES.LIVE, this.now());
      if (aggregate.status === DATA_STATUSES.LIVE) {
        this.updateSourceStatus(DATA_STATUSES.LIVE, aggregate.fetchedAt);
        return aggregate;
      }
      const cachedFallback = this.loadCachedQuery(query);
      if (cachedFallback) return cachedFallback;
      return aggregate;
    }

    const cached = this.loadCachedQuery(query);
    if (cached) return cached;
    return emptyMetrics(
      DATA_STATUSES.UNAVAILABLE,
      this.now(),
      'GSC credentials are not configured and no matching cache record exists.'
    );
  }

  async loadCluster(queries) {
    const uniqueQueries = [...new Map(
      queries.map(query => [normalizeQueryKey(query), query]).filter(([key]) => key)
    ).values()];
    const queryResults = await Promise.all(uniqueQueries.map(query => this.loadQuery(query)));
    const available = queryResults.filter(result => result.status !== DATA_STATUSES.UNAVAILABLE);
    if (!available.length) {
      const errors = [...new Set(queryResults.map(result => result.error).filter(Boolean))];
      return emptyMetrics(
        DATA_STATUSES.UNAVAILABLE,
        latestTimestamp(queryResults, this.now()),
        errors.join('; ') || 'No GSC evidence for this cluster.',
        { queryEvidence: queryResults.flatMap(item => item.queryEvidence || []) }
      );
    }

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
    const status = available.some(item => item.status === DATA_STATUSES.LIVE)
      ? DATA_STATUSES.LIVE
      : DATA_STATUSES.CACHED;
    const statusRecords = available.filter(item => item.status === status);

    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : null,
      position: weightedPosition == null ? null : Math.round(weightedPosition * 10) / 10,
      rankingUrls,
      dateRange: available.find(item => item.dateRange)?.dateRange || null,
      source: 'google_search_console',
      status,
      fetchedAt: latestTimestamp(statusRecords),
      error: null,
      queryEvidence: queryResults.flatMap(item => item.queryEvidence || [])
    };
  }
}

export { normalizeQueryKey };
