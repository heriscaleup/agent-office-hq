// Google Search Console API client — live keyword ranking data.
// Auth uses a GCP service account (JWT Bearer flow), signed with Node's built-in
// crypto module. No external SDK/npm dependency, to keep the "ultra-lightweight"
// footprint described in README.md.
//
// Required env var: GSC_SERVICE_ACCOUNT_JSON — the full JSON key file contents
// of a GCP service account that has been added as a user on the target
// Search Console properties. See README.md "Setup Google Search Console" for
// step-by-step instructions.

import crypto from 'crypto';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEARCH_ANALYTICS_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites';

let cachedToken = null; // { accessToken, expiresAt }

function loadServiceAccount() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`GSC_SERVICE_ACCOUNT_JSON is not valid JSON: ${e.message}`);
  }
}

export function isConfigured() {
  return !!process.env.GSC_SERVICE_ACCOUNT_JSON;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const account = loadServiceAccount();
  if (!account) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is not configured');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: TOKEN_ENDPOINT,
    iat: nowSec,
    exp: nowSec + 3600
  };

  const unsigned = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claim)).toString('base64url')}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(account.private_key).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GSC auth failed: ${data.error_description || data.error || res.status}`);
  }

  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Looks up a keyword's live average position for a given Search Console
 * property. Google Search Console lags real-time by ~2-3 days, and only
 * returns a row if the query had at least one impression in the window.
 */
export async function queryKeywordPosition(siteUrl, keyword, { windowDays = 28, lagDays = 3 } = {}) {
  const token = await getAccessToken();

  const end = new Date();
  end.setDate(end.getDate() - lagDays);
  const start = new Date(end);
  start.setDate(start.getDate() - windowDays);

  const body = {
    startDate: formatDate(start),
    endDate: formatDate(end),
    dimensions: ['query', 'page'],
    dimensionFilterGroups: [{
      filters: [{ dimension: 'query', operator: 'equals', expression: keyword }]
    }],
    rowLimit: 10
  };

  const url = `${SEARCH_ANALYTICS_ENDPOINT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GSC query failed for "${keyword}" on ${siteUrl}: ${data.error?.message || res.status}`);
  }

  const rows = data.rows || [];
  if (rows.length === 0) {
    return { found: false, position: null, clicks: 0, impressions: 0, ctr: 0, page: null };
  }

  const best = rows.reduce((a, b) => (a.position < b.position ? a : b));
  return {
    found: true,
    position: Math.round(best.position * 10) / 10,
    clicks: best.clicks,
    impressions: best.impressions,
    ctr: Math.round(best.ctr * 1000) / 10,
    page: best.keys[1]
  };
}
