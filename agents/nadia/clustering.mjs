import { CLUSTERING_RULES } from './constants.mjs';
import { normalizeQuery } from './intent.mjs';

export function keywordTokens(keyword) {
  const normalized = normalizeQuery(keyword);
  const tokens = normalized.split(' ')
    .filter(Boolean)
    .map(token => CLUSTERING_RULES.synonyms[token] || token)
    .filter(token => !CLUSTERING_RULES.stopWords.includes(token));
  return [...new Set(tokens)];
}

export function tokenSimilarity(left, right) {
  const a = new Set(keywordTokens(left));
  const b = new Set(keywordTokens(right));
  if (!a.size || !b.size) return 0;
  const distinguishingA = new Set([...a].filter(token => CLUSTERING_RULES.distinguishingTokens.includes(token)));
  const distinguishingB = new Set([...b].filter(token => CLUSTERING_RULES.distinguishingTokens.includes(token)));
  if ((distinguishingA.size || distinguishingB.size)
    && ![...distinguishingA].some(token => distinguishingB.has(token))) {
    return 0;
  }
  const intersection = [...a].filter(token => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function comparePrimaryCandidates(a, b) {
  return (
    (b.businessRelevance - a.businessRelevance)
    || ((b.clicks || 0) - (a.clicks || 0))
    || ((b.cost || 0) - (a.cost || 0))
    || a.searchTerm.localeCompare(b.searchTerm)
  );
}

function selectPrimary(items) {
  return [...items].sort(comparePrimaryCandidates)[0];
}

function titleCase(value) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

export function clusterSearchTerms(items, threshold = CLUSTERING_RULES.similarityThreshold) {
  const clusters = [];
  // Highest-value candidates become stable representatives first. Membership
  // must remain coherent with that representative, not merely any member.
  const orderedItems = [...items].sort(comparePrimaryCandidates);

  for (const item of orderedItems) {
    let bestCluster = null;
    let bestSimilarity = 0;

    for (const cluster of clusters) {
      const similarity = tokenSimilarity(item.searchTerm, cluster.primary.searchTerm);
      if (similarity >= threshold && similarity > bestSimilarity) {
        bestCluster = cluster;
        bestSimilarity = similarity;
      }
    }

    if (bestCluster) bestCluster.items.push(item);
    else clusters.push({ primary: item, items: [item] });
  }

  return clusters.map(cluster => {
    const primary = selectPrimary(cluster.items);
    return {
      cluster: titleCase(primary.searchTerm),
      primaryKeyword: primary.searchTerm,
      supportingQueries: cluster.items.map(item => item.searchTerm).filter(term => term !== primary.searchTerm),
      items: cluster.items
    };
  });
}
