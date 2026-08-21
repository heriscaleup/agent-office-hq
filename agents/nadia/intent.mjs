import { INTENTS, INTENT_RULES, RELEVANCE_RULES } from './constants.mjs';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function includesAny(query, indicators) {
  return indicators.some(indicator => query.includes(indicator));
}

export function classifyIntent(searchTerm) {
  const query = normalize(searchTerm);
  if (!query) return INTENTS.UNKNOWN;
  if (includesAny(query, INTENT_RULES.irrelevant)) return INTENTS.IRRELEVANT;
  if (includesAny(query, INTENT_RULES.navigational)) return INTENTS.NAVIGATIONAL;
  if (includesAny(query, INTENT_RULES.transactional)) return INTENTS.TRANSACTIONAL;
  if (includesAny(query, INTENT_RULES.commercial)) return INTENTS.COMMERCIAL;
  if (includesAny(query, INTENT_RULES.informational)) return INTENTS.INFORMATIONAL;
  if (query.includes('laser') || query.includes('cnc')) return INTENTS.UNKNOWN;
  return INTENTS.UNKNOWN;
}

export function calculateBusinessRelevance(searchTerm) {
  const query = normalize(searchTerm);
  if (!query || includesAny(query, RELEVANCE_RULES.employment)) return 0;

  let score = 0;
  if (includesAny(query, RELEVANCE_RULES.coreServices)) score += 50;
  else if (query.includes('laser') || query.includes('cnc')) score += 20;

  if (includesAny(query, RELEVANCE_RULES.serviceSignals)) score += 25;
  if (includesAny(query, RELEVANCE_RULES.materials)) score += 25;
  if (includesAny(query, RELEVANCE_RULES.locations)) score += 10;
  if (query.includes('harga') || query.includes('biaya')) score += 20;
  if (query.includes('inspirasi') || query.includes('contoh') || query.includes('motif')) score += 5;

  if (includesAny(query, RELEVANCE_RULES.machineCommerce)) return Math.min(score, 15);
  if (includesAny(query, RELEVANCE_RULES.freeAsset)) return Math.min(Math.max(score, 45), 45);
  if (includesAny(query, RELEVANCE_RULES.diy)) return Math.min(score, 40);
  if (query.includes('inspirasi') || query.includes('contoh') || query.includes('motif')) return Math.min(score, 65);

  return Math.max(0, Math.min(100, score));
}

export { normalize as normalizeQuery };
