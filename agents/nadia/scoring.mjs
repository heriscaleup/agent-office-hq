import { CLASSIFICATION_THRESHOLDS, INTENTS, SCORING_WEIGHTS } from './constants.mjs';

const INTENT_POINTS = Object.freeze({
  [INTENTS.TRANSACTIONAL]: 20,
  [INTENTS.COMMERCIAL]: 18,
  [INTENTS.INFORMATIONAL]: 8,
  [INTENTS.NAVIGATIONAL]: 5,
  [INTENTS.UNKNOWN]: 5,
  [INTENTS.IRRELEVANT]: 0
});

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function rankingOpportunity(position) {
  if (!Number.isFinite(position)) return 0;
  if (position <= 3) return 0.2;
  if (position <= 10) return 0.6;
  if (position <= 20) return 1;
  if (position <= 40) return 0.7;
  if (position <= 60) return 0.4;
  return 0.15;
}

export function classifyOpportunity(score, { intent, businessRelevance } = {}) {
  if (intent === INTENTS.IRRELEVANT || businessRelevance <= 20) return 'DISCARD';
  return CLASSIFICATION_THRESHOLDS.find(item => score >= item.min).value;
}

export function calculateOpportunityScore({ intent, businessRelevance, ads = {}, gsc = {} }) {
  const components = {
    businessRelevance: clamp(businessRelevance / 100) * SCORING_WEIGHTS.businessRelevance,
    buyerIntent: (INTENT_POINTS[intent] || 0) / 20 * SCORING_WEIGHTS.buyerIntent,
    paidTrafficEvidence: clamp((ads.clicks || 0) / 20) * SCORING_WEIGHTS.paidTrafficEvidence,
    paidCostPressure: Math.max(
      clamp((ads.avgCpc || 0) / 25000),
      clamp((ads.cost || 0) / 1000000)
    ) * SCORING_WEIGHTS.paidCostPressure,
    searchDemand: clamp((gsc.impressions || 0) / 1000) * SCORING_WEIGHTS.searchDemand,
    organicRankingOpportunity: rankingOpportunity(gsc.position) * SCORING_WEIGHTS.organicRankingOpportunity,
    conversionEvidence: clamp((ads.conversions || 0) / 3) * SCORING_WEIGHTS.conversionEvidence
  };

  let score = Object.values(components).reduce((sum, value) => sum + value, 0);
  if (intent === INTENTS.IRRELEVANT || businessRelevance <= 20) score = Math.min(score, 29);
  score = Math.round(score * 10) / 10;

  return {
    score,
    classification: classifyOpportunity(score, { intent, businessRelevance }),
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value * 10) / 10]))
  };
}

