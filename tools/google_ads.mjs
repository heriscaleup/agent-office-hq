import { DATA_STATUSES } from '../agents/nadia/constants.mjs';

const OMNIRANK_SOURCE = 'google_ads_via_omnirank';
const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_MAX_ROWS = 10000;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;

function numeric(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const firstNumber = value.match(/[\d.,]+/i)?.[0];
  if (!firstNumber) return 0;
  return Number(firstNumber.replaceAll('.', '').replace(',', '.')) || 0;
}

function machineNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function normalizeCustomerId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/[-\s]/g, '');
  return /^\d{3,20}$/.test(normalized) ? normalized : '';
}

function validateGatewayBaseUrl(value, env) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.username || url.password || url.search || url.hash) return '';
    if (url.protocol === 'https:' || (env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
      return url.toString().replace(/\/$/, '');
    }
  } catch {}
  return '';
}

export function readOmniRankGoogleAdsConfig(env = process.env) {
  const rawBaseUrl = String(env.OMNIRANK_BASE_URL || '').trim();
  const sharedSecret = String(env.OMNIRANK_AGENT_SHARED_SECRET || '').trim();
  const configuredCount = Number(Boolean(rawBaseUrl)) + Number(Boolean(sharedSecret));
  const state = configuredCount === 0 ? 'NONE' : configuredCount === 2 ? 'FULL' : 'PARTIAL';
  const baseUrl = validateGatewayBaseUrl(rawBaseUrl, env);
  const customerId = normalizeCustomerId(env.NADIA_GOOGLE_ADS_CUSTOMER_ID);
  return {
    state: state === 'FULL' && !baseUrl ? 'INVALID' : state,
    baseUrl,
    sharedSecret,
    customerId,
    customerIdValid: !env.NADIA_GOOGLE_ADS_CUSTOMER_ID || Boolean(customerId),
    lookbackDays: boundedInteger(env.NADIA_GOOGLE_ADS_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS, 7, 365),
    maxRows: boundedInteger(env.NADIA_MAX_GOOGLE_ADS_ROWS, DEFAULT_MAX_ROWS, 1, DEFAULT_MAX_ROWS)
  };
}

function normalizeLiveTerm(item, provider, dateRange) {
  const clicks = machineNumber(item.clicks);
  const impressions = machineNumber(item.impressions);
  const conversions = machineNumber(item.conversions);
  const currencyCode = item.currencyCode || provider.currencyCode || null;
  return {
    searchTerm: String(item.searchTerm || '').trim(),
    customerId: item.customerId ? String(item.customerId) : null,
    campaignId: item.campaignId ? String(item.campaignId) : null,
    campaign: item.campaign || null,
    adGroupId: item.adGroupId ? String(item.adGroupId) : null,
    adGroup: item.adGroup || null,
    campaignType: item.campaignType || null,
    matchSource: item.matchSource || null,
    clicks,
    impressions,
    cost: machineNumber(item.cost),
    avgCpc: machineNumber(item.avgCpc),
    conversions,
    conversionValue: machineNumber(item.conversionValue),
    ctr: item.ctr == null ? (impressions ? clicks / impressions : null) : machineNumber(item.ctr),
    conversionRate: item.conversionRate == null ? (clicks ? conversions / clicks : null) : machineNumber(item.conversionRate),
    currencyCode,
    costScoringCompatible: currencyCode === 'IDR',
    dateRange: item.dateRange || dateRange || null,
    source: OMNIRANK_SOURCE,
    status: DATA_STATUSES.LIVE,
    gateway: 'omnirank',
    upstream: 'google_ads',
    fetchedAt: item.fetchedAt || provider.fetchedAt
  };
}

function unavailableResult(reasonCode, health = 'CONFIG_ERROR', details = {}) {
  return {
    source: OMNIRANK_SOURCE,
    status: DATA_STATUSES.UNAVAILABLE,
    fetchedAt: new Date().toISOString(),
    dateRange: null,
    items: [],
    error: 'OmniRank Google Ads gateway is unavailable.',
    provider: { source: OMNIRANK_SOURCE, status: DATA_STATUSES.UNAVAILABLE, health, reasonCode, gateway: 'OMNIRANK', ...details }
  };
}

function reasonForHttpStatus(status) {
  if (status === 401 || status === 403) return 'GATEWAY_UNAUTHORIZED';
  if (status === 429) return 'GATEWAY_RATE_LIMITED';
  if (status >= 500) return 'GATEWAY_UPSTREAM_ERROR';
  return 'GATEWAY_REQUEST_FAILED';
}

function transientStatus(status) {
  return status === 429 || status >= 500;
}

export class OmniRankGoogleAdsProvider {
  constructor({ env = process.env, fetcher = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, sleep } = {}) {
    this.env = env;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.sleep = sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.lastResult = null;
  }

  configStatus() {
    const config = readOmniRankGoogleAdsConfig(this.env);
    if (config.state === 'NONE') return unavailableResult('MISSING_CONFIG');
    if (config.state === 'PARTIAL') return unavailableResult('PARTIAL_CONFIG');
    if (config.state === 'INVALID' || !config.customerIdValid) return unavailableResult('INVALID_CONFIG');
    return null;
  }

  async request(url, secret) {
    let lastReason = 'GATEWAY_NETWORK_ERROR';
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, {
          method: 'GET',
          headers: { Accept: 'application/json', 'x-omnirank-agent-secret': secret },
          signal: controller.signal
        });
        let payload;
        try { payload = await response.json(); } catch { return { ok: false, reasonCode: 'MALFORMED_GATEWAY_RESPONSE', health: 'UPSTREAM_ERROR' }; }
        if (response.ok) return { ok: true, payload };
        lastReason = reasonForHttpStatus(response.status);
        if (!transientStatus(response.status) || attempt === this.retries) {
          return { ok: false, reasonCode: lastReason, health: response.status === 401 || response.status === 403 ? 'AUTH_ERROR' : 'UPSTREAM_ERROR' };
        }
      } catch (error) {
        lastReason = error?.name === 'AbortError' ? 'GATEWAY_TIMEOUT' : 'GATEWAY_NETWORK_ERROR';
        if (attempt === this.retries) return { ok: false, reasonCode: lastReason, health: lastReason === 'GATEWAY_TIMEOUT' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR' };
      } finally {
        clearTimeout(timer);
      }
      await this.sleep(250 * (2 ** attempt));
    }
    return { ok: false, reasonCode: lastReason, health: 'UPSTREAM_ERROR' };
  }

  async loadSearchTerms() {
    const configFailure = this.configStatus();
    if (configFailure) return (this.lastResult = configFailure);
    const config = readOmniRankGoogleAdsConfig(this.env);
    const url = new URL(`${config.baseUrl}/api/ads/search-terms`);
    url.searchParams.set('days', String(config.lookbackDays));
    if (config.customerId) url.searchParams.set('customerId', config.customerId);
    const gateway = await this.request(url, config.sharedSecret);
    if (!gateway.ok) return (this.lastResult = unavailableResult(gateway.reasonCode, gateway.health));

    const payload = gateway.payload;
    if (!payload?.success || payload?.provider?.status !== DATA_STATUSES.LIVE || !Array.isArray(payload.data)) {
      const reasonCode = payload?.provider?.reasonCode || 'INVALID_GATEWAY_CONTRACT';
      return (this.lastResult = unavailableResult(reasonCode, payload?.provider?.health || 'UPSTREAM_ERROR'));
    }
    const fetchedAt = typeof payload.provider.fetchedAt === 'string' ? payload.provider.fetchedAt : null;
    if (!fetchedAt || Number.isNaN(Date.parse(fetchedAt))) {
      return (this.lastResult = unavailableResult('INVALID_GATEWAY_CONTRACT', 'UPSTREAM_ERROR'));
    }

    const received = payload.data.length;
    const items = payload.data.slice(0, config.maxRows)
      .map(item => normalizeLiveTerm(item, payload.provider, payload.dateRange))
      .filter(item => item.searchTerm);
    const truncated = Boolean(payload.truncated) || received > config.maxRows;
    const health = payload.provider.health === 'DEGRADED' || truncated ? 'DEGRADED' : 'READY';
    return (this.lastResult = {
      source: OMNIRANK_SOURCE,
      status: DATA_STATUSES.LIVE,
      fetchedAt,
      dateRange: payload.dateRange || null,
      items,
      error: null,
      rowsReceived: Number(payload.rowsReceived ?? received),
      rowsLoaded: items.length,
      truncated,
      provider: {
        source: OMNIRANK_SOURCE,
        status: DATA_STATUSES.LIVE,
        health,
        gateway: 'OMNIRANK',
        upstream: 'google_ads',
        apiVersion: payload.provider.apiVersion || null,
        currencyCode: payload.provider.currencyCode || null,
        lastSuccessfulFetch: fetchedAt,
        rowsLoaded: items.length,
        dateRange: payload.dateRange || null,
        searchCampaigns: payload.provider.subSources?.searchCampaigns || 'UNAVAILABLE',
        performanceMax: payload.provider.subSources?.performanceMax || 'UNAVAILABLE',
        truncated
      }
    });
  }

  getStatus() {
    if (this.lastResult?.provider) return this.lastResult.provider;
    const failure = this.configStatus();
    if (failure) return failure.provider;
    const config = readOmniRankGoogleAdsConfig(this.env);
    return {
      source: OMNIRANK_SOURCE,
      status: DATA_STATUSES.UNAVAILABLE,
      health: 'NOT_FETCHED',
      reasonCode: 'NOT_FETCHED',
      gateway: 'OMNIRANK',
      lookbackDays: config.lookbackDays,
      rowsLoaded: 0
    };
  }
}

export class GoogleAdsProvider extends OmniRankGoogleAdsProvider {}

function normalizeManualTerm(item, fetchedAt) {
  const clicks = numeric(item.clicks);
  const cost = numeric(item.cost);
  const impressions = numeric(item.impressions);
  const conversions = numeric(item.conversions);
  return {
    searchTerm: String(item.search_term || item.searchTerm || item.term || '').trim(),
    campaign: item.campaign || null,
    adGroup: item.ad_group || item.adGroup || null,
    clicks,
    impressions,
    cost,
    avgCpc: numeric(item.avg_cpc ?? item.avgCpc) || (clicks ? cost / clicks : 0),
    conversions,
    conversionValue: numeric(item.conversion_value ?? item.conversionValue),
    ctr: Number.isFinite(item.ctr) ? item.ctr : (impressions ? clicks / impressions : null),
    conversionRate: Number.isFinite(item.conversion_rate ?? item.conversionRate)
      ? Number(item.conversion_rate ?? item.conversionRate)
      : (clicks ? conversions / clicks : null),
    currencyCode: item.currencyCode || 'IDR',
    costScoringCompatible: (item.currencyCode || 'IDR') === 'IDR',
    dateRange: item.date_range || item.dateRange || null,
    legacyCategory: item.category || null,
    source: 'google_ads_search_terms_manual',
    status: DATA_STATUSES.MANUAL,
    fetchedAt
  };
}

export class ManualGoogleAdsProvider {
  constructor(records = []) { this.records = records; }

  async loadSearchTerms() {
    const fetchedAt = new Date().toISOString();
    const items = this.records.map(item => normalizeManualTerm(item, fetchedAt)).filter(item => item.searchTerm);
    return {
      source: 'google_ads_search_terms_manual',
      status: items.length ? DATA_STATUSES.MANUAL : DATA_STATUSES.UNAVAILABLE,
      fetchedAt,
      dateRange: items.find(item => item.dateRange)?.dateRange || null,
      items,
      error: items.length ? null : 'No manual Google Ads search terms were supplied.'
    };
  }
}

export class GoogleAdsSource {
  constructor({ liveProvider = new GoogleAdsProvider(), manualProvider }) {
    this.liveProvider = liveProvider;
    this.manualProvider = manualProvider;
  }

  async loadSearchTerms() {
    const live = await this.liveProvider.loadSearchTerms();
    if (live.status === DATA_STATUSES.LIVE) return live;
    const manual = await this.manualProvider.loadSearchTerms();
    return {
      ...manual,
      fallbackFrom: {
        source: live.source,
        status: live.status,
        health: live.provider?.health || 'UNAVAILABLE',
        reasonCode: live.provider?.reasonCode || 'GATEWAY_UNAVAILABLE'
      }
    };
  }
}

export { normalizeLiveTerm, normalizeManualTerm };
