import crypto from 'crypto';
import { CLASSIFICATIONS, RECOMMENDATIONS } from './constants.mjs';

const ACTIONS = Object.freeze({
  [RECOMMENDATIONS.OPTIMIZE_EXISTING]: [
    'Improve title and meta description for the primary intent.',
    'Expand service and material sections using evidenced supporting queries.',
    'Add relevant commercial FAQ content.',
    'Review internal links into the target page.',
    'Measure GSC query/page movement after implementation.'
  ],
  [RECOMMENDATIONS.CREATE_NEW_PAGE]: [
    'Create a dedicated landing page mapped to the keyword cluster.',
    'Address transactional requirements and service coverage.',
    'Add proof, specifications, FAQ, and conversion paths.',
    'Link from relevant existing service and location pages.'
  ],
  [RECOMMENDATIONS.CREATE_SUPPORTING_CONTENT]: [
    'Create supporting content that answers the cluster intent.',
    'Link prominently to the closest commercial service page.',
    'Avoid unsupported performance or pricing claims.',
    'Track the cluster in GSC after publication.'
  ],
  [RECOMMENDATIONS.MERGE_CANNIBALIZATION]: [
    'Review all materially ranking URLs for intent overlap.',
    'Choose a canonical target page for the cluster.',
    'Merge or differentiate overlapping sections.',
    'Update internal links and canonical signals.',
    'Monitor query/page distribution in GSC.'
  ],
  [RECOMMENDATIONS.MONITOR]: ['Monitor paid and organic evidence before committing content resources.'],
  [RECOMMENDATIONS.DISCARD]: ['Do not create an SEO asset for this cluster.']
});

export function buildSeoTask(opportunity) {
  const digest = crypto.createHash('sha256').update(opportunity.id).digest('hex').slice(0, 10).toUpperCase();
  const priority = opportunity.classification === CLASSIFICATIONS.HIGH_PRIORITY
    ? 'HIGH'
    : opportunity.classification === CLASSIFICATIONS.SEO_EXPERIMENT ? 'MEDIUM' : 'LOW';

  return {
    taskId: `SEO-TASK-${digest}`,
    opportunityId: opportunity.id,
    createdBy: 'nadia',
    assignedTo: 'maya',
    status: 'PROPOSED',
    priority,
    title: `${opportunity.recommendation.replaceAll('_', ' ')}: ${opportunity.cluster}`,
    goal: 'Improve qualified organic visibility for the evidenced keyword cluster without fabricating performance claims.',
    targetKeywords: [opportunity.primaryKeyword, ...opportunity.supportingQueries],
    targetUrl: opportunity.existingUrl,
    recommendation: opportunity.recommendation,
    recommendedActions: ACTIONS[opportunity.recommendation] || ACTIONS[RECOMMENDATIONS.MONITOR],
    evidence: opportunity.evidence,
    createdAt: new Date().toISOString()
  };
}

