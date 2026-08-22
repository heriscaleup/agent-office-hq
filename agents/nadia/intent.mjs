import { INTENTS, INTENT_RULES, RELEVANCE_RULES } from './constants.mjs';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function hasToken(value, token) {
  const queryTokens = normalize(value).split(' ').filter(Boolean);
  const normalizedToken = normalize(token);
  return Boolean(normalizedToken) && !normalizedToken.includes(' ') && queryTokens.includes(normalizedToken);
}

export function hasPhrase(value, phrase) {
  const query = normalize(value);
  const normalizedPhrase = normalize(phrase);
  if (!query || !normalizedPhrase) return false;
  return ` ${query} `.includes(` ${normalizedPhrase} `);
}

export function matchesIndicator(value, indicator) {
  const normalizedIndicator = normalize(indicator);
  return normalizedIndicator.includes(' ')
    ? hasPhrase(value, normalizedIndicator)
    : hasToken(value, normalizedIndicator);
}

function matchesAny(query, indicators) {
  return indicators.some(indicator => matchesIndicator(query, indicator));
}

export function classifyIntent(searchTerm) {
  const query = normalize(searchTerm);
  if (!query) return INTENTS.UNKNOWN;
  if (matchesAny(query, INTENT_RULES.irrelevant)) return INTENTS.IRRELEVANT;
  if (matchesAny(query, INTENT_RULES.navigational)) return INTENTS.NAVIGATIONAL;
  if (matchesAny(query, INTENT_RULES.transactional)) return INTENTS.TRANSACTIONAL;
  if (matchesAny(query, INTENT_RULES.commercial)) return INTENTS.COMMERCIAL;
  if (matchesAny(query, INTENT_RULES.informational)) return INTENTS.INFORMATIONAL;
  if (hasToken(query, 'laser') || hasToken(query, 'cnc')) return INTENTS.UNKNOWN;
  return INTENTS.UNKNOWN;
}

export function calculateBusinessRelevance(searchTerm) {
  const query = normalize(searchTerm);
  if (!query || matchesAny(query, RELEVANCE_RULES.employment)) return 0;

  let score = 0;
  if (matchesAny(query, RELEVANCE_RULES.coreServices)) score += 50;
  else if (hasToken(query, 'laser') || hasToken(query, 'cnc')) score += 20;

  if (matchesAny(query, RELEVANCE_RULES.serviceSignals)) score += 25;
  if (matchesAny(query, RELEVANCE_RULES.materials)) score += 25;
  if (matchesAny(query, RELEVANCE_RULES.locations)) score += 10;
  if (hasToken(query, 'harga') || hasToken(query, 'biaya')) score += 20;
  if (matchesAny(query, ['inspirasi', 'contoh', 'motif'])) score += 5;

  if (matchesAny(query, RELEVANCE_RULES.machineCommerce)) return Math.min(score, 15);
  if (matchesAny(query, RELEVANCE_RULES.freeAsset)) return Math.min(Math.max(score, 45), 45);
  if (matchesAny(query, RELEVANCE_RULES.diy)) return Math.min(score, 40);
  if (matchesAny(query, ['inspirasi', 'contoh', 'motif'])) return Math.min(score, 65);

  return Math.max(0, Math.min(100, score));
}

export { normalize as normalizeQuery };
