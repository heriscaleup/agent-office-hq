import crypto from 'crypto';
import { CANNIBALIZATION_RULES, CLASSIFICATIONS, INTENTS, RECOMMENDATIONS } from './constants.mjs';
import { calculateOpportunityScore } from './scoring.mjs';

function sum(items, field) {
  return items.reduce((total, item) => total + (Number(item[field]) || 0), 0);
}

function weightedAverage(items, valueField, weightField) {
  const weighted = items.reduce((total, item) => total + (Number(item[valueField]) || 0) * (Number(item[weightField]) || 0), 0);
  const weights = sum(items, weightField);
  return weights ? weighted / weights : 0;
}

function stableId(prefix, value) {
  return `${prefix}-${crypto.createHash('sha256').update(value).digest('hex').slice(0, 10).toUpperCase()}`;
}

function detectCannibalization(rankingUrls) {
  if (!Array.isArray(rankingUrls) || rankingUrls.length < CANNIBALIZATION_RULES.minimumMaterialPages) return false;
  const maxImpressions = Math.max(...rankingUrls.map(page => page.impressions || 0), 0);
  const materialPages = rankingUrls.filter(page =>
    (page.impressions || 0) >= CANNIBALIZATION_RULES.minimumImpressions
    && (maxImpressions === 0 || (page.impressions || 0) / maxImpressions >= CANNIBALIZATION_RULES.relativeImpressionShare)
    && Number(page.position) <= CANNIBALIZATION_RULES.maximumPosition
  );
  return materialPages.length >= CANNIBALIZATION_RULES.minimumMaterialPages;
}

function chooseRecommendation({ classification, intent, existingPageFound, cannibalization }) {
  if (classification === CLASSIFICATIONS.DISCARD) return RECOMMENDATIONS.DISCARD;
  if (cannibalization) return RECOMMENDATIONS.MERGE_CANNIBALIZATION;
  if (existingPageFound && [CLASSIFICATIONS.HIGH_PRIORITY, CLASSIFICATIONS.SEO_EXPERIMENT].includes(classification)) {
    return RECOMMENDATIONS.OPTIMIZE_EXISTING;
  }
  if (intent === INTENTS.INFORMATIONAL || classification === CLASSIFICATIONS.SUPPORTING_CONTENT) {
    return RECOMMENDATIONS.CREATE_SUPPORTING_CONTENT;
  }
  if (!existingPageFound && [CLASSIFICATIONS.HIGH_PRIORITY, CLASSIFICATIONS.SEO_EXPERIMENT].includes(classification)) {
    return RECOMMENDATIONS.CREATE_NEW_PAGE;
  }
  return RECOMMENDATIONS.MONITOR;
}

function buildReasoning({ businessRelevance, intent, ads, gsc, cannibalization, classification }) {
  const reasoning = [];
  if (businessRelevance >= 80) reasoning.push('Business relevance is high for TepatLaser services.');
  else if (businessRelevance >= 50) reasoning.push('Query is relevant but not a direct core-service demand signal.');
  else reasoning.push('Business relevance is weak or outside the current service scope.');
  if ([INTENTS.TRANSACTIONAL, INTENTS.COMMERCIAL].includes(intent)) reasoning.push(`Intent is ${intent.toLowerCase()} and indicates buyer consideration.`);
  if ((ads.clicks || 0) > 0) reasoning.push(`Paid evidence includes ${ads.clicks} clicks and ${ads.cost || 0} recorded cost.`);
  if ((ads.conversions || 0) === 0 && (ads.clicks || 0) > 0) reasoning.push('Zero recorded conversions did not trigger an automatic discard.');
  if ((gsc.impressions || 0) > 0) reasoning.push(`GSC evidence includes ${gsc.impressions} impressions at average position ${gsc.position}.`);
  if (cannibalization) reasoning.push('Multiple materially visible URLs indicate potential keyword cannibalization.');
  if (classification === CLASSIFICATIONS.DISCARD) reasoning.push('Hard relevance/intent gate limits this opportunity to DISCARD.');
  return reasoning;
}

function buildEvidence(cluster, ads, gsc, derivedAnalysis) {
  const adsEvidence = cluster.items.map(item => ({
    type: 'PAID_SEARCH_TERM',
    query: item.searchTerm,
    source: item.source,
    status: item.status,
    fetchedAt: item.fetchedAt,
    metrics: {
      clicks: item.clicks,
      impressions: item.impressions,
      cost: item.cost,
      avgCpc: item.avgCpc,
      conversions: item.conversions
    }
  }));
  const gscEvidence = (gsc.queryEvidence || []).map(item => ({ type: 'GSC_QUERY', ...item }));
  return [
    ...adsEvidence,
    ...gscEvidence,
    {
      type: 'DERIVED_ANALYSIS',
      source: 'nadia_rule_engine_v1',
      status: 'MANUAL',
      fetchedAt: derivedAnalysis.analyzedAt,
      ruleVersion: '1.0.0',
      metrics: {
        intent: derivedAnalysis.intent,
        businessRelevance: derivedAnalysis.businessRelevance,
        opportunityScore: derivedAnalysis.opportunityScore,
        classification: derivedAnalysis.classification
      }
    }
  ];
}

export function buildOpportunity(cluster, gscMetrics) {
  const items = cluster.items;
  const clicks = sum(items, 'clicks');
  const impressions = sum(items, 'impressions');
  const cost = sum(items, 'cost');
  const conversions = sum(items, 'conversions');
  const conversionValue = sum(items, 'conversionValue');
  const ads = {
    clicks,
    impressions,
    cost,
    avgCpc: clicks ? Math.round(cost / clicks) : weightedAverage(items, 'avgCpc', 'clicks'),
    conversions,
    conversionValue,
    ctr: impressions ? clicks / impressions : null,
    conversionRate: clicks ? conversions / clicks : null,
    campaigns: [...new Set(items.map(item => item.campaign).filter(Boolean))],
    adGroups: [...new Set(items.map(item => item.adGroup).filter(Boolean))],
    dateRange: items.find(item => item.dateRange)?.dateRange || null,
    source: items[0]?.source || 'google_ads',
    status: items[0]?.status || 'UNAVAILABLE',
    fetchedAt: items[0]?.fetchedAt || null
  };

  const intent = [...items].sort((a, b) => b.businessRelevance - a.businessRelevance)[0].intent;
  const businessRelevance = Math.max(...items.map(item => item.businessRelevance));
  const rankingUrls = gscMetrics.rankingUrls || [];
  const cannibalization = detectCannibalization(rankingUrls);
  const existingPageFound = rankingUrls.length > 0;
  const scoreResult = calculateOpportunityScore({ intent, businessRelevance, ads, gsc: gscMetrics });
  const recommendation = chooseRecommendation({
    classification: scoreResult.classification,
    intent,
    existingPageFound,
    cannibalization
  });
  const analyzedAt = new Date().toISOString();
  const derivedAnalysis = {
    analyzedAt,
    intent,
    businessRelevance,
    opportunityScore: scoreResult.score,
    classification: scoreResult.classification
  };

  return {
    id: stableId('SEO-OPP', cluster.primaryKeyword),
    cluster: cluster.cluster,
    primaryKeyword: cluster.primaryKeyword,
    supportingQueries: cluster.supportingQueries,
    intent,
    businessRelevance,
    ads,
    gsc: {
      impressions: gscMetrics.impressions || 0,
      clicks: gscMetrics.clicks || 0,
      ctr: gscMetrics.ctr ?? null,
      position: gscMetrics.position ?? null,
      rankingUrls,
      dateRange: gscMetrics.dateRange || null,
      source: gscMetrics.source,
      status: gscMetrics.status,
      fetchedAt: gscMetrics.fetchedAt
    },
    existingPageFound,
    existingUrl: rankingUrls[0]?.url || null,
    cannibalization,
    opportunityScore: scoreResult.score,
    scoreComponents: scoreResult.components,
    classification: scoreResult.classification,
    recommendation,
    reasoning: buildReasoning({ businessRelevance, intent, ads, gsc: gscMetrics, cannibalization, classification: scoreResult.classification }),
    evidence: buildEvidence(cluster, ads, gscMetrics, derivedAnalysis),
    analyzedAt
  };
}
