import { CLASSIFICATION_THRESHOLDS, INTENTS, SCORING_CALIBRATION, SCORING_WEIGHTS } from './constants.mjs';

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
  if (!Number.isFinite(position)) return { factor: 0, bandMaximumPosition: null };
  const band = SCORING_CALIBRATION.organicPositionFactors.find(item => position <= item.maximumPosition);
  return {
    factor: band.factor,
    bandMaximumPosition: Number.isFinite(band.maximumPosition) ? band.maximumPosition : null
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function explainComponent(points, max, input, calibration) {
  return { points: round(points), max, input, calibration };
}

export function classifyOpportunity(score, { intent, businessRelevance } = {}) {
  if (intent === INTENTS.IRRELEVANT || businessRelevance <= 20) return 'DISCARD';
  return CLASSIFICATION_THRESHOLDS.find(item => score >= item.min).value;
}

export function calculateOpportunityScore({ intent, businessRelevance, ads = {}, gsc = {} }) {
  const intentPoints = INTENT_POINTS[intent] || 0;
  const ranking = rankingOpportunity(gsc.position);
  const costScoringCompatible = ads.costScoringCompatible !== false;
  const costPressureFactor = costScoringCompatible
    ? Math.max(
      clamp((ads.avgCpc || 0) / SCORING_CALIBRATION.cpcForMaxCostPressure),
      clamp((ads.cost || 0) / SCORING_CALIBRATION.costForMaxPressure)
    )
    : 0;
  const rawComponents = {
    businessRelevance: clamp(businessRelevance / SCORING_CALIBRATION.businessRelevanceForMaxPoints) * SCORING_WEIGHTS.businessRelevance,
    buyerIntent: intentPoints / SCORING_CALIBRATION.buyerIntentPointsForMax * SCORING_WEIGHTS.buyerIntent,
    paidTrafficEvidence: clamp((ads.clicks || 0) / SCORING_CALIBRATION.clicksForMaxPaidEvidence) * SCORING_WEIGHTS.paidTrafficEvidence,
    paidCostPressure: costPressureFactor * SCORING_WEIGHTS.paidCostPressure,
    searchDemand: clamp((gsc.impressions || 0) / SCORING_CALIBRATION.impressionsForMaxDemand) * SCORING_WEIGHTS.searchDemand,
    organicRankingOpportunity: ranking.factor * SCORING_WEIGHTS.organicRankingOpportunity,
    conversionEvidence: clamp((ads.conversions || 0) / SCORING_CALIBRATION.conversionsForMaxEvidence) * SCORING_WEIGHTS.conversionEvidence
  };

  let score = Object.values(rawComponents).reduce((sum, value) => sum + value, 0);
  if (intent === INTENTS.IRRELEVANT || businessRelevance <= 20) score = Math.min(score, 29);
  score = round(score);

  const components = Object.fromEntries(Object.entries(rawComponents).map(([key, value]) => [key, round(value)]));
  const componentDetails = {
    businessRelevance: explainComponent(rawComponents.businessRelevance, SCORING_WEIGHTS.businessRelevance, businessRelevance, {
      valueForMaxPoints: SCORING_CALIBRATION.businessRelevanceForMaxPoints
    }),
    buyerIntent: explainComponent(rawComponents.buyerIntent, SCORING_WEIGHTS.buyerIntent, { intent, intentPoints }, {
      intentPointsForMax: SCORING_CALIBRATION.buyerIntentPointsForMax
    }),
    paidTrafficEvidence: explainComponent(rawComponents.paidTrafficEvidence, SCORING_WEIGHTS.paidTrafficEvidence, { clicks: ads.clicks || 0 }, {
      clicksForMaxPoints: SCORING_CALIBRATION.clicksForMaxPaidEvidence
    }),
    paidCostPressure: explainComponent(rawComponents.paidCostPressure, SCORING_WEIGHTS.paidCostPressure, {
      avgCpc: ads.avgCpc || 0,
      cost: ads.cost || 0,
      currencyCode: ads.currencyCode || null,
      costScoringCompatible
    }, {
      cpcForMaxPoints: SCORING_CALIBRATION.cpcForMaxCostPressure,
      costForMaxPoints: SCORING_CALIBRATION.costForMaxPressure,
      method: 'MAX_OF_CPC_OR_TOTAL_COST_PRESSURE',
      compatibleCurrency: 'IDR'
    }),
    searchDemand: explainComponent(rawComponents.searchDemand, SCORING_WEIGHTS.searchDemand, { impressions: gsc.impressions || 0 }, {
      impressionsForMaxPoints: SCORING_CALIBRATION.impressionsForMaxDemand
    }),
    organicRankingOpportunity: explainComponent(rawComponents.organicRankingOpportunity, SCORING_WEIGHTS.organicRankingOpportunity, {
      position: Number.isFinite(gsc.position) ? gsc.position : null
    }, {
      factor: ranking.factor,
      bandMaximumPosition: ranking.bandMaximumPosition
    }),
    conversionEvidence: explainComponent(rawComponents.conversionEvidence, SCORING_WEIGHTS.conversionEvidence, {
      conversions: ads.conversions || 0
    }, {
      conversionsForMaxPoints: SCORING_CALIBRATION.conversionsForMaxEvidence
    })
  };

  return {
    score,
    classification: classifyOpportunity(score, { intent, businessRelevance }),
    components,
    componentDetails
  };
}
