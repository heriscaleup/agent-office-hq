import { DATA_STATUSES } from '../agents/nadia/constants.mjs';

function numeric(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const firstNumber = value.match(/[\d.,]+/i)?.[0];
  if (!firstNumber) return 0;
  return Number(firstNumber.replaceAll('.', '').replace(',', '.')) || 0;
}

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
    dateRange: item.date_range || item.dateRange || null,
    legacyCategory: item.category || null,
    source: 'google_ads_search_terms_manual',
    status: DATA_STATUSES.MANUAL,
    fetchedAt
  };
}

export class GoogleAdsProvider {
  async loadSearchTerms() {
    return {
      source: 'google_ads',
      status: DATA_STATUSES.UNAVAILABLE,
      fetchedAt: new Date().toISOString(),
      dateRange: null,
      items: [],
      error: 'Google Ads API provider is not configured.'
    };
  }
}

export class ManualGoogleAdsProvider {
  constructor(records = []) {
    this.records = records;
  }

  async loadSearchTerms() {
    const fetchedAt = new Date().toISOString();
    const items = this.records.map(item => normalizeManualTerm(item, fetchedAt)).filter(item => item.searchTerm);
    return {
      source: 'google_ads_search_terms_manual',
      status: items.length ? DATA_STATUSES.MANUAL : DATA_STATUSES.UNAVAILABLE,
      fetchedAt,
      dateRange: null,
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
    if (live.status === DATA_STATUSES.LIVE && live.items.length) return live;
    const manual = await this.manualProvider.loadSearchTerms();
    return {
      ...manual,
      fallbackFrom: { source: live.source, status: live.status, error: live.error }
    };
  }
}

export { normalizeManualTerm };

