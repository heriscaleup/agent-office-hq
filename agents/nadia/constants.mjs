export const DATA_STATUSES = Object.freeze({
  LIVE: 'LIVE',
  CACHED: 'CACHED',
  MANUAL: 'MANUAL',
  SIMULATED: 'SIMULATED',
  UNAVAILABLE: 'UNAVAILABLE'
});

export const INTENTS = Object.freeze({
  TRANSACTIONAL: 'TRANSACTIONAL',
  COMMERCIAL: 'COMMERCIAL',
  INFORMATIONAL: 'INFORMATIONAL',
  NAVIGATIONAL: 'NAVIGATIONAL',
  IRRELEVANT: 'IRRELEVANT',
  UNKNOWN: 'UNKNOWN'
});

export const CLASSIFICATIONS = Object.freeze({
  HIGH_PRIORITY: 'HIGH_PRIORITY',
  SEO_EXPERIMENT: 'SEO_EXPERIMENT',
  SUPPORTING_CONTENT: 'SUPPORTING_CONTENT',
  MONITOR: 'MONITOR',
  DISCARD: 'DISCARD'
});

export const RECOMMENDATIONS = Object.freeze({
  OPTIMIZE_EXISTING: 'OPTIMIZE_EXISTING',
  CREATE_NEW_PAGE: 'CREATE_NEW_PAGE',
  CREATE_SUPPORTING_CONTENT: 'CREATE_SUPPORTING_CONTENT',
  MERGE_CANNIBALIZATION: 'MERGE_CANNIBALIZATION',
  MONITOR: 'MONITOR',
  DISCARD: 'DISCARD'
});

export const NADIA_PERMISSIONS = Object.freeze([
  'READ_GOOGLE_ADS',
  'READ_GSC',
  'READ_WEBSITE_METADATA',
  'ANALYZE',
  'CREATE_OPPORTUNITY',
  'CREATE_PROPOSED_TASK'
]);

export const NADIA_DENIED_CAPABILITIES = Object.freeze([
  'EDIT_WEBSITE',
  'PUBLISH_ARTICLE',
  'MERGE_PR',
  'DEPLOY_PRODUCTION',
  'CHANGE_GOOGLE_ADS_BUDGET',
  'ADD_NEGATIVE_KEYWORDS',
  'DELETE_CONTENT'
]);

export const INTENT_RULES = Object.freeze({
  transactional: ['jasa', 'pesan', 'order', 'custom', 'terdekat', 'hubungi', 'vendor', 'supplier'],
  commercial: ['harga', 'biaya', 'murah', 'terbaik', 'rekomendasi', 'per meter', 'stainless', 'plat', 'akrilik', 'mdf'],
  informational: ['cara', 'inspirasi', 'contoh', 'tips', 'desain', 'motif', 'apa itu', 'panduan'],
  navigational: ['tepat laser', 'tepatlaser', 'raja cutting', 'rajacuttinglaser', 'jasalasercutting'],
  irrelevant: ['lowongan', 'loker', 'gaji', 'operator', 'skripsi', 'manual mesin', 'jual mesin', 'mesin bekas', 'second olx']
});

export const RELEVANCE_RULES = Object.freeze({
  coreServices: ['laser cutting', 'laser cut', 'cutting laser', 'potong plat', 'potong stainless', 'cnc router', 'cutting mdf'],
  serviceSignals: ['jasa', 'cutting', 'potong', 'custom', 'vendor', 'supplier'],
  materials: ['stainless', 'steel', 'ss', 'plat', 'besi', 'aluminium', 'akrilik', 'acrylic', 'mdf', 'kayu', 'acp', 'fasad', 'pagar', 'mihrab'],
  locations: ['tangerang', 'tangsel', 'jakarta', 'bintaro', 'bsd', 'serpong', 'banten', 'jabodetabek', 'terdekat'],
  employment: ['lowongan', 'loker', 'gaji', 'operator'],
  machineCommerce: ['jual mesin', 'harga mesin', 'mesin bekas', 'second olx'],
  freeAsset: ['gratis', 'free', 'download', 'dxf'],
  diy: ['cara membuat', 'sendiri', 'tutorial']
});

export const SCORING_WEIGHTS = Object.freeze({
  businessRelevance: 25,
  buyerIntent: 20,
  paidTrafficEvidence: 15,
  paidCostPressure: 10,
  searchDemand: 10,
  organicRankingOpportunity: 10,
  conversionEvidence: 10
});

export const CLASSIFICATION_THRESHOLDS = Object.freeze([
  { min: 85, value: CLASSIFICATIONS.HIGH_PRIORITY },
  { min: 70, value: CLASSIFICATIONS.SEO_EXPERIMENT },
  { min: 50, value: CLASSIFICATIONS.SUPPORTING_CONTENT },
  { min: 30, value: CLASSIFICATIONS.MONITOR },
  { min: 0, value: CLASSIFICATIONS.DISCARD }
]);

export const CANNIBALIZATION_RULES = Object.freeze({
  minimumMaterialPages: 2,
  minimumImpressions: 5,
  relativeImpressionShare: 0.15,
  maximumPosition: 50
});

export const CLUSTERING_RULES = Object.freeze({
  similarityThreshold: 0.55,
  stopWords: ['jasa', 'harga', 'biaya', 'vendor', 'supplier', 'terdekat', 'di', 'dan', 'untuk', 'per'],
  distinguishingTokens: ['stainless', 'kayu', 'mdf', 'besi', 'plat', 'aluminium', 'akrilik', 'acp', 'fasad', 'pagar', 'mihrab'],
  synonyms: {
    potong: 'cutting',
    cut: 'cutting',
    steel: 'stainless',
    ss: 'stainless',
    acrylic: 'akrilik',
    tangsel: 'tangerang'
  }
});

export const GSC_SITES = Object.freeze([
  { key: 'tepatlaser', domain: 'tepatlaser.com', env: 'GSC_SITE_TEPATLASER', defaultUrl: 'https://tepatlaser.com/' },
  { key: 'rajacutting', domain: 'rajacuttinglaser.com', env: 'GSC_SITE_RAJACUTTING', defaultUrl: 'https://rajacuttinglaser.com/' },
  { key: 'jasalasercutting', domain: 'jasalasercutting.com', env: 'GSC_SITE_JASALASERCUTTING', defaultUrl: 'https://jasalasercutting.com/' }
]);
