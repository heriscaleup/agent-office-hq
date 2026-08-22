import { DATA_STATUSES } from '../agents/nadia/constants.mjs';

export const GOOGLE_ADS_DEFAULTS = Object.freeze({
  apiVersion: 'v25', lookbackDays: 90, minimumLookbackDays: 7, maximumLookbackDays: 365,
  maxRows: 10000, timeoutMs: 20000, maxRetries: 2, tokenRefreshSkewMs: 60000,
  minimumResponseBytes: 1_048_576, maximumResponseBytes: 134_217_728,
  estimatedBytesPerRow: 8192, idrCurrencyCode: 'IDR'
});

export const GOOGLE_ADS_REQUIRED_ENV = Object.freeze([
  'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'
]);

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const API_ORIGIN = 'https://googleads.googleapis.com';

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export function normalizeCustomerId(value) {
  return String(value || '').replaceAll('-', '').replaceAll(' ', '').trim();
}

export function readGoogleAdsConfig(env = process.env) {
  const configuredCount = GOOGLE_ADS_REQUIRED_ENV.filter(name => String(env[name] || '').trim()).length;
  const configurationState = configuredCount === 0 ? 'NONE'
    : configuredCount === GOOGLE_ADS_REQUIRED_ENV.length ? 'FULL' : 'PARTIAL';
  const apiVersion = String(env.GOOGLE_ADS_API_VERSION || GOOGLE_ADS_DEFAULTS.apiVersion).trim();
  const customerId = normalizeCustomerId(env.GOOGLE_ADS_CUSTOMER_ID);
  const loginCustomerId = normalizeCustomerId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const identifiersValid = (!customerId || /^\d+$/.test(customerId))
    && (!loginCustomerId || /^\d+$/.test(loginCustomerId));
  return {
    configurationState,
    valid: configurationState === 'FULL' && /^v\d+$/.test(apiVersion) && identifiersValid,
    apiVersion,
    developerToken: String(env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim(),
    clientId: String(env.GOOGLE_ADS_CLIENT_ID || '').trim(),
    clientSecret: String(env.GOOGLE_ADS_CLIENT_SECRET || '').trim(),
    refreshToken: String(env.GOOGLE_ADS_REFRESH_TOKEN || '').trim(),
    customerId,
    loginCustomerId,
    lookbackDays: clampInteger(env.NADIA_GOOGLE_ADS_LOOKBACK_DAYS, 90, 7, 365),
    maxRows: clampInteger(env.NADIA_MAX_GOOGLE_ADS_ROWS, 10000, 1, 100000)
  };
}

function numeric(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const firstNumber = value.match(/[\d.,]+/i)?.[0];
  return firstNumber ? Number(firstNumber.replaceAll('.', '').replace(',', '.')) || 0 : 0;
}

function apiNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function microsToCurrency(value) {
  return apiNumber(value) / 1_000_000;
}

function normalizeManualTerm(item, fetchedAt) {
  const clicks = numeric(item.clicks);
  const cost = numeric(item.cost);
  const impressions = numeric(item.impressions);
  const conversions = numeric(item.conversions);
  return {
    searchTerm: String(item.search_term || item.searchTerm || item.term || '').trim(),
    campaignId: item.campaign_id || item.campaignId || null,
    campaign: item.campaign || null,
    adGroupId: item.ad_group_id || item.adGroupId || null,
    adGroup: item.ad_group || item.adGroup || null,
    campaignType: item.campaign_type || item.campaignType || null,
    clicks, impressions, cost,
    avgCpc: numeric(item.avg_cpc ?? item.avgCpc) || (clicks ? cost / clicks : 0),
    conversions,
    conversionValue: numeric(item.conversion_value ?? item.conversionValue),
    ctr: Number.isFinite(item.ctr) ? item.ctr : (impressions ? clicks / impressions : null),
    conversionRate: Number.isFinite(item.conversion_rate ?? item.conversionRate)
      ? Number(item.conversion_rate ?? item.conversionRate) : (clicks ? conversions / clicks : null),
    dateRange: item.date_range || item.dateRange || null,
    legacyCategory: item.category || null,
    currencyCode: item.currency_code || item.currencyCode || null,
    costScoringCompatible: item.cost_scoring_compatible ?? item.costScoringCompatible ?? true,
    source: 'google_ads_search_terms_manual', status: DATA_STATUSES.MANUAL, fetchedAt
  };
}

function dateInTimeZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function buildDateRange(now, lookbackDays, timeZone = 'UTC') {
  const end = new Date(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (lookbackDays - 1));
  return { startDate: dateInTimeZone(start, timeZone), endDate: dateInTimeZone(end, timeZone) };
}

export function buildSearchTermsGaql(dateRange) {
  return `SELECT
  search_term_view.search_term,
  search_term_view.status,
  campaign.id,
  campaign.name,
  campaign.advertising_channel_type,
  ad_group.id,
  ad_group.name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.average_cpc,
  metrics.ctr,
  metrics.conversions,
  metrics.conversions_value,
  segments.search_term_match_source
FROM search_term_view
WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
  AND campaign.advertising_channel_type = 'SEARCH'`;
}

export function buildPerformanceMaxGaql(dateRange) {
  return `SELECT
  campaign_search_term_view.search_term,
  campaign.id,
  campaign.name,
  campaign.advertising_channel_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.average_cpc,
  metrics.ctr,
  metrics.conversions,
  metrics.conversions_value,
  segments.search_term_match_source
FROM campaign_search_term_view
WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
  AND segments.search_term_match_source = 'PERFORMANCE_MAX'`;
}

export const CUSTOMER_METADATA_GAQL = 'SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1';

function flattenSearchStream(payload) {
  if (!Array.isArray(payload)) throw providerError('MALFORMED_RESPONSE');
  const rows = [];
  for (const batch of payload) {
    if (!batch || !Array.isArray(batch.results)) throw providerError('MALFORMED_RESPONSE');
    rows.push(...batch.results);
  }
  return rows;
}

export function normalizeGoogleAdsRow(row, { campaignType, dateRange, fetchedAt, currencyCode }) {
  const metrics = row?.metrics || {};
  const searchTerm = String(row?.searchTermView?.searchTerm || row?.campaignSearchTermView?.searchTerm || '').trim();
  const clicks = apiNumber(metrics.clicks);
  const impressions = apiNumber(metrics.impressions);
  const conversions = apiNumber(metrics.conversions);
  return {
    searchTerm,
    campaignId: row?.campaign?.id || null,
    campaign: row?.campaign?.name || null,
    adGroupId: row?.adGroup?.id || null,
    adGroup: row?.adGroup?.name || null,
    campaignType,
    searchTermStatus: row?.searchTermView?.status || null,
    matchSource: row?.segments?.searchTermMatchSource || null,
    clicks, impressions,
    cost: microsToCurrency(metrics.costMicros),
    avgCpc: microsToCurrency(metrics.averageCpc),
    conversions,
    conversionValue: apiNumber(metrics.conversionsValue),
    ctr: metrics.ctr == null ? (impressions ? clicks / impressions : null) : apiNumber(metrics.ctr),
    conversionRate: clicks ? conversions / clicks : 0,
    dateRange,
    currencyCode: currencyCode || null,
    costScoringCompatible: currencyCode === GOOGLE_ADS_DEFAULTS.idrCurrencyCode,
    source: 'google_ads', status: DATA_STATUSES.LIVE, fetchedAt
  };
}

function providerError(reasonCode, { httpStatus = null, requestId = null, transient = false } = {}) {
  const error = new Error(reasonCode);
  error.code = reasonCode;
  error.httpStatus = httpStatus;
  error.requestId = requestId;
  error.transient = transient;
  return error;
}

function reasonForHttpStatus(status) {
  if (status === 400) return 'GAQL_ERROR';
  if (status === 401) return 'AUTHENTICATION_ERROR';
  if (status === 403) return 'AUTHORIZATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'GOOGLE_API_UNAVAILABLE';
  return 'GOOGLE_API_ERROR';
}

function publicFailure(error) {
  return { reasonCode: error?.code || 'PROVIDER_ERROR', httpStatus: error?.httpStatus || null, requestId: error?.requestId || null };
}

export class GoogleAdsProvider {
  constructor({ env = process.env, fetchImpl = globalThis.fetch, now = () => new Date(),
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    timeoutMs = GOOGLE_ADS_DEFAULTS.timeoutMs, maxRetries = GOOGLE_ADS_DEFAULTS.maxRetries,
    maxResponseBytes = null } = {}) {
    this.config = readGoogleAdsConfig(env);
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.sleep = sleep;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.maxResponseBytes = maxResponseBytes || Math.max(
      GOOGLE_ADS_DEFAULTS.minimumResponseBytes,
      Math.min(GOOGLE_ADS_DEFAULTS.maximumResponseBytes, this.config.maxRows * GOOGLE_ADS_DEFAULTS.estimatedBytesPerRow)
    );
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.state = {
      dataStatus: DATA_STATUSES.UNAVAILABLE,
      health: this.config.configurationState === 'FULL' ? 'CONFIGURED' : 'CONFIG_ERROR',
      reasonCode: this.config.configurationState === 'FULL' ? null
        : this.config.configurationState === 'PARTIAL' ? 'PARTIAL_CONFIG' : 'MISSING_CREDENTIALS',
      lastSuccessfulFetch: null, searchCampaigns: 'UNAVAILABLE', performanceMax: 'UNAVAILABLE',
      rowsReceived: 0, rowsProcessed: 0, truncated: false, warnings: []
    };
    if (this.config.configurationState === 'FULL' && !this.config.valid) {
      this.state.health = 'CONFIG_ERROR';
      this.state.reasonCode = 'INVALID_CONFIG';
    }
  }

  getStatus() {
    return {
      source: 'google_ads', dataStatus: this.state.dataStatus, health: this.state.health,
      reasonCode: this.state.reasonCode, apiVersion: this.config.apiVersion,
      customerConfigured: Boolean(this.config.customerId), managerAccountConfigured: Boolean(this.config.loginCustomerId),
      lastSuccessfulFetch: this.state.lastSuccessfulFetch, lookbackDays: this.config.lookbackDays,
      maxRows: this.config.maxRows, searchCampaigns: this.state.searchCampaigns,
      performanceMax: this.state.performanceMax, rowsReceived: this.state.rowsReceived,
      rowsProcessed: this.state.rowsProcessed, truncated: this.state.truncated,
      currencyCode: this.state.currencyCode || null,
      costScoringCompatible: this.state.costScoringCompatible ?? false,
      warnings: [...(this.state.warnings || [])]
    };
  }

  async readBoundedJson(response) {
    const declaredLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
      await response.body?.cancel?.();
      throw providerError('RESPONSE_TOO_LARGE');
    }
    if (!response.body?.getReader) return response.json();
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > this.maxResponseBytes) {
        await reader.cancel();
        throw providerError('RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async requestJson(url, options, { requestType = 'api' } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      timeout.unref?.();
      try {
        const response = await this.fetchImpl(url, { ...options, signal: controller.signal });
        const requestId = response.headers?.get?.('request-id') || null;
        if (!response.ok) {
          const reasonCode = requestType === 'oauth' ? 'OAUTH_ERROR' : reasonForHttpStatus(response.status);
          throw providerError(reasonCode, { httpStatus: response.status, requestId,
            transient: response.status === 429 || response.status >= 500 });
        }
        try {
          return { payload: await this.readBoundedJson(response), requestId };
        } catch (error) {
          if (error?.code) throw error;
          throw providerError('MALFORMED_RESPONSE', { requestId });
        }
      } catch (error) {
        if (error?.name === 'AbortError') lastError = providerError('TIMEOUT', { transient: true });
        else if (error?.code) lastError = error;
        else lastError = providerError('NETWORK_ERROR', { transient: true });
        if (!lastError.transient || attempt === this.maxRetries) throw lastError;
        await this.sleep(250 * (2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError || providerError('PROVIDER_ERROR');
  }

  async getAccessToken() {
    if (this.accessToken && this.accessTokenExpiresAt - GOOGLE_ADS_DEFAULTS.tokenRefreshSkewMs > this.now().getTime()) return this.accessToken;
    const body = new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret,
      refresh_token: this.config.refreshToken, grant_type: 'refresh_token' });
    const { payload } = await this.requestJson(TOKEN_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString()
    }, { requestType: 'oauth' });
    if (typeof payload?.access_token !== 'string' || !payload.access_token) throw providerError('OAUTH_MALFORMED_RESPONSE');
    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = this.now().getTime() + Math.max(1, apiNumber(payload.expires_in)) * 1000;
    return this.accessToken;
  }

  async runGaql(query) {
    const accessToken = await this.getAccessToken();
    const headers = { authorization: `Bearer ${accessToken}`, 'developer-token': this.config.developerToken,
      'content-type': 'application/json' };
    if (this.config.loginCustomerId) headers['login-customer-id'] = this.config.loginCustomerId;
    const url = `${API_ORIGIN}/${this.config.apiVersion}/customers/${this.config.customerId}/googleAds:searchStream`;
    const { payload, requestId } = await this.requestJson(url, { method: 'POST', headers, body: JSON.stringify({ query }) });
    return { rows: flattenSearchStream(payload), requestId };
  }

  async loadMetadata() {
    const { rows, requestId } = await this.runGaql(CUSTOMER_METADATA_GAQL);
    const customer = rows[0]?.customer || {};
    return { currencyCode: customer.currencyCode || null, timeZone: customer.timeZone || 'UTC', requestId };
  }

  async loadSubSource(name, query, context) {
    try {
      const { rows, requestId } = await this.runGaql(query);
      return { name, status: DATA_STATUSES.LIVE, rows, requestId, error: null, context };
    } catch (error) {
      return { name, status: DATA_STATUSES.UNAVAILABLE, rows: [], error: publicFailure(error), context };
    }
  }

  unavailableResult(reasonCode = this.state.reasonCode) {
    return { source: 'google_ads', status: DATA_STATUSES.UNAVAILABLE, fetchedAt: this.now().toISOString(),
      dateRange: null, items: [], health: this.state.health, reasonCode, provider: this.getStatus() };
  }

  async loadSearchTerms() {
    if (!this.config.valid) return this.unavailableResult();
    let metadata = { currencyCode: null, timeZone: 'UTC' };
    const warnings = [];
    try {
      metadata = await this.loadMetadata();
    } catch (error) {
      warnings.push({ scope: 'customer_metadata', ...publicFailure(error) });
    }

    const dateRange = buildDateRange(this.now(), this.config.lookbackDays, metadata.timeZone);
    const subSources = await Promise.all([
      this.loadSubSource('searchCampaigns', buildSearchTermsGaql(dateRange), { campaignType: 'SEARCH' }),
      this.loadSubSource('performanceMax', buildPerformanceMaxGaql(dateRange), { campaignType: 'PERFORMANCE_MAX' })
    ]);
    const liveSources = subSources.filter(source => source.status === DATA_STATUSES.LIVE);
    if (!liveSources.length) {
      const failure = subSources.find(source => source.error)?.error || { reasonCode: 'PROVIDER_ERROR' };
      this.state = { ...this.state, dataStatus: DATA_STATUSES.UNAVAILABLE, health: 'API_ERROR',
        reasonCode: failure.reasonCode, searchCampaigns: 'UNAVAILABLE', performanceMax: 'UNAVAILABLE',
        warnings: [...warnings, ...subSources.flatMap(source => source.error ? [{ scope: source.name, ...source.error }] : [])] };
      return this.unavailableResult(failure.reasonCode);
    }

    const fetchedAt = this.now().toISOString();
    const allRows = subSources.flatMap(source => source.rows.map(row => ({ row, context: source.context })));
    const rowsReceived = allRows.length;
    const selectedRows = allRows.slice(0, this.config.maxRows);
    const truncated = rowsReceived > this.config.maxRows;
    if (truncated) warnings.push({ scope: 'row_limit', reasonCode: 'MAX_ROWS_EXCEEDED' });
    for (const source of subSources.filter(source => source.error)) warnings.push({ scope: source.name, ...source.error });

    const seen = new Set();
    const items = [];
    for (const { row, context } of selectedRows) {
      const item = normalizeGoogleAdsRow(row, { campaignType: context.campaignType, dateRange, fetchedAt,
        currencyCode: metadata.currencyCode });
      if (!item.searchTerm) continue;
      const identity = [item.campaignType, item.campaignId, item.adGroupId, item.matchSource, item.searchTerm.toLowerCase()].join('|');
      if (seen.has(identity)) continue;
      seen.add(identity);
      items.push(item);
    }

    const costScoringCompatible = metadata.currencyCode === GOOGLE_ADS_DEFAULTS.idrCurrencyCode;
    if (!costScoringCompatible) warnings.push({ scope: 'currency',
      reasonCode: metadata.currencyCode ? 'NON_IDR_COST_SCORING_DISABLED' : 'CURRENCY_UNAVAILABLE' });
    const degraded = liveSources.length !== subSources.length || truncated || warnings.length > 0;
    this.state = { dataStatus: DATA_STATUSES.LIVE, health: degraded ? 'DEGRADED' : 'READY',
      reasonCode: degraded ? 'PARTIAL_DATA' : null, lastSuccessfulFetch: fetchedAt,
      searchCampaigns: subSources.find(source => source.name === 'searchCampaigns').status,
      performanceMax: subSources.find(source => source.name === 'performanceMax').status,
      rowsReceived, rowsProcessed: items.length, truncated, currencyCode: metadata.currencyCode,
      costScoringCompatible, warnings };
    return { source: 'google_ads', status: DATA_STATUSES.LIVE, fetchedAt, dateRange, items,
      health: this.state.health, currencyCode: metadata.currencyCode, costScoringCompatible,
      subSources: { searchCampaigns: this.state.searchCampaigns, performanceMax: this.state.performanceMax },
      rowsReceived, rowsProcessed: items.length, truncated, warnings, error: null };
  }
}

export class ManualGoogleAdsProvider {
  constructor(records = []) { this.records = records; }
  async loadSearchTerms() {
    const fetchedAt = new Date().toISOString();
    const items = this.records.map(item => normalizeManualTerm(item, fetchedAt)).filter(item => item.searchTerm);
    return { source: 'google_ads_search_terms_manual',
      status: items.length ? DATA_STATUSES.MANUAL : DATA_STATUSES.UNAVAILABLE,
      fetchedAt, dateRange: items.find(item => item.dateRange)?.dateRange || null, items,
      error: items.length ? null : 'No manual Google Ads search terms were supplied.' };
  }
}

export class GoogleAdsSource {
  constructor({ liveProvider = new GoogleAdsProvider(), manualProvider = new ManualGoogleAdsProvider() }) {
    this.liveProvider = liveProvider;
    this.manualProvider = manualProvider;
  }
  async loadSearchTerms() {
    const live = await this.liveProvider.loadSearchTerms();
    if (live.status === DATA_STATUSES.LIVE) return live;
    const manual = await this.manualProvider.loadSearchTerms();
    if (manual.status === DATA_STATUSES.UNAVAILABLE) {
      return {
        ...live,
        manualFallback: { source: manual.source, status: manual.status, reasonCode: 'NO_MANUAL_DATA' }
      };
    }
    return { ...manual, fallbackFrom: { source: live.source, status: live.status,
      health: live.health || 'UNAVAILABLE', reasonCode: live.reasonCode || 'PROVIDER_UNAVAILABLE' } };
  }
}

export { normalizeManualTerm };
