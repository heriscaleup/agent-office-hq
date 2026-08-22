# 🎮 TepatLaser AI Swarm HQ & Live SERP Telemetry

> **Level-4 Autonomous Operations Room, Virtual Pixel Office, GA4 & GEO Intelligence Room for TepatLaser Fleet**

---

## 🌟 Features

- 🏢 **Virtual Pixel Office**: 8-bit HTML5 Canvas animated office with real-time AI agent status.
- 📊 **Executive KPI & SERP Telemetry**: Live Google Page 1 ranking tracker, competitor benchmarking, and anti-cannibalization metrics.
- 💬 **Live Interrogation Console**: 1-on-1 direct debate terminal with AI employees (Maya, Nadia, Rian, Budi, Gilang) backed by contextual ground-truth data.
- 🛡️ **Level-4 Cyberpunk Security Gate**: Environment-backed master access control, HMAC-SHA256 session token, and Path Traversal Shield.
- 🚀 **Ultra-Lightweight Footprint**: Consumes ~11MB RAM and 0.00% CPU on Ubuntu VPS.

---

## 🤖 Swarm Workforce Roster

| Agent | Role | Core Engine | Primary Mission |
| :--- | :--- | :--- | :--- |
| **👩‍💼 Maya (`aero-writer`)** | Lead SEO & Tech Copywriter | Claude 3.5 Sonnet + Astro Engine | 107 Location Hub Silos (Bintaro Sektor 1-9 & BSD) |
| **👩‍💻 Nadia (`radar-x`)** | SEO Intelligence Agent | Deterministic Rule Engine + Evidence Providers | Paid Waste to Organic Opportunity Analysis |
| **👨‍💻 Rian (`iron-shield`)** | PPC & Budget Auditor | Gemini 1.5 Flash + Python Rule-Gate | Negative Keyword Shield (1.909 terms, Save Rp 7.85M/wk) |
| **👨‍💼 Budi (`hermes-sentry`)** | Customer Success & Lead Ops | FastAPI + Telegram Bot + SQLite | WhatsApp Lead Dispatcher (`0821-2129-2937`) |
| **👨‍🔧 Gilang (`cloud-forge`)** | DevOps & Server Architect | GitHub Actions + Cloudflare + Traefik | Multi-Cloud Deployment & VPS 163.61.44.41 Health |

---

## 🚀 Running Locally

```bash
# Start server
npm start

# Access local dashboard
http://localhost:3333
```

## Nadia v1 — SEO Intelligence Agent

Nadia converts Google Ads search-term evidence into clustered SEO opportunities and proposed tasks for Maya. Core intent, relevance, clustering, scoring, recommendations, and task generation are deterministic and do not require an LLM.

Authenticated endpoints:

- `GET /api/agents/nadia/status`
- `GET /api/agents/nadia/google-ads/status`
- `GET /api/agents/nadia/opportunities?classification=&minScore=&limit=`
- `POST /api/agents/nadia/analyze`
- `POST /api/agents/nadia/tasks` with `{ "opportunityId": "..." }`

Data status is explicit: `LIVE`, `CACHED`, `MANUAL`, `DERIVED`, `SIMULATED`, `UNAVAILABLE`. The current legacy `SEARCH_TERMS_VAULT_DATA` fallback is always labelled `MANUAL`; it is never presented as live Google Ads API data. GSC is labelled `LIVE` only after a successful outbound API request, `CACHED` when matching disk-cache evidence is used, and `UNAVAILABLE` when neither is available. Competitor SERP and LLM providers remain `UNAVAILABLE` until configured. Deterministic intent, relevance, score, classification, recommendation, existing-page state, and cannibalization outputs carry a `nadia_rule_engine_v1` evidence record labelled `DERIVED`; derived calculations are never labelled live.

Persistence uses atomic JSON replacement under `data/nadia/` for opportunities, proposed SEO tasks, and analysis audit records. Nadia v1 has no publish, deploy, Google Ads mutation, content deletion, or PR merge capability.

Opportunity score weights total 100 points: business relevance 25, buyer intent 20, paid traffic evidence 15, paid cost/CPC pressure 10, GSC search demand 10, organic ranking opportunity 10, and conversion evidence 10. Calibration reaches maximum evidence at 20 paid clicks, Rp25,000 average CPC or Rp1,000,000 cost, 1,000 GSC impressions, and 3 conversions. These references live in `SCORING_CALIBRATION`, while each opportunity exposes numeric `scoreComponents` for compatibility and machine-readable `scoreExplanation` records with points, maximums, inputs, and calibration references. Conversion is evidence, not a mandatory gate. Irrelevant intent or business relevance at/below 20 is hard-capped into `DISCARD`. Buckets are `HIGH_PRIORITY` 85+, `SEO_EXPERIMENT` 70+, `SUPPORTING_CONTENT` 50+, `MONITOR` 30+, and `DISCARD` below 30.

Existing-page evidence uses `FOUND`, `NOT_FOUND`, or `UNKNOWN`. When GSC is unavailable, Nadia returns `UNKNOWN`, keeps `existingPageFound` as `null`, and will not recommend a new page from missing evidence. Recommendation priority remains discard, cannibalization merge, optimize an evidenced existing page, create only when absence is evidenced, then monitor.

GSC requests are deduplicated by normalized query for each analysis run and pass through a lightweight bounded queue. `NADIA_GSC_CONCURRENCY` defaults to 4 and is capped at 5; `NADIA_MAX_GSC_QUERIES` defaults to 300 unique queries. Hitting the query limit degrades the audit run without crashing or inventing GSC metrics.

### Google Ads live search terms (read-only)

Nadia v1.1 first attempts the Google Ads API and uses the legacy vault only when the live provider is unavailable. A successful API query is labelled `LIVE`; fallback records remain `MANUAL`. Search campaigns use `search_term_view`, while Performance Max uses `campaign_search_term_view` without keyword-related segments. The connector only reads reporting resources and exposes no mutation capability.

Configure production with placeholders through GitHub Secrets/Variables; never commit real values:

```text
GOOGLE_ADS_DEVELOPER_TOKEN=<set in GitHub Secret>
GOOGLE_ADS_CLIENT_ID=<set in GitHub Secret>
GOOGLE_ADS_CLIENT_SECRET=<set in GitHub Secret>
GOOGLE_ADS_REFRESH_TOKEN=<set in GitHub Secret>
GOOGLE_ADS_CUSTOMER_ID=<target customer ID, set in GitHub Secret>
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<optional manager customer ID, set in GitHub Secret>
GOOGLE_ADS_API_VERSION=v25
NADIA_GOOGLE_ADS_LOOKBACK_DAYS=90
NADIA_MAX_GOOGLE_ADS_ROWS=10000
```

`GOOGLE_ADS_CUSTOMER_ID` is the Ads account whose reporting data is queried. `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is only needed when access is made through a manager account; both IDs may be entered with dashes and are normalized before requests. The API version is centralized and configurable. Lookback is clamped to 7–365 days, outbound requests time out after 20 seconds, transient failures receive at most two retries, and processing is capped by the configured row limit. SearchStream response reading also has a bounded byte budget derived from that row limit, capped at 128 MiB, so a pathological response cannot grow memory without limit. Access tokens are refreshed and cached in memory only.

The account currency is read from Google Ads. Existing CPC/cost calibration is IDR-specific, so the paid cost-pressure score is disabled when the account currency is not IDR or cannot be verified. Actual monetary metrics remain present with their currency provenance. Missing or partial Ads configuration does not stop HQ startup; provider health reports `UNAVAILABLE`, and manual fallback is used if available.

---

## 🌐 Live Production Deployment

- **Public Production URL**: `https://seo.tepatlaser.com`
- **Host VPS**: `163.61.44.41` (Ubuntu 24.04, Coolify & Traefik Reverse Proxy)
- **Container**: `agent-office-hq` on Docker internal bridge network `coolify`.

---

## 📈 Setup Google Search Console (Organic Performance Evidence)

The KPI dashboard's keyword ranking cache is refreshed from the **Google Search Console API**
and served by `/api/serp-audit`; the endpoint itself does not perform a live fetch. Competitor benchmarking
(who ranks #1/#2/#3 above us) is **not** available through this API, so that part
stays a manually-curated list until a paid SERP API is added.

Google Search Console is not a real-time SERP API. Nadia uses it as delayed organic performance evidence for clicks, impressions, CTR, average position, and ranking-page distribution.

Without setup, the dashboard runs fine but shows `"Belum Pernah Diaudit"` / no data —
it will never silently show made-up rankings.

### 1. Create a GCP service account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable the **Search Console API**: *APIs & Services → Library → search "Search Console API" → Enable*.
3. Create a service account: *IAM & Admin → Service Accounts → Create Service Account* (any name, e.g. `serp-reader`). No project role needed.
4. Open the service account → *Keys → Add Key → Create new key → JSON*. This downloads a `.json` key file — **keep it private, never commit it to git**.

### 2. Grant the service account access to each property

For **each** of the 3 domains (`tepatlaser.com`, `rajacuttinglaser.com`, `jasalasercutting.com`):

1. Open [Google Search Console](https://search.google.com/search-console) → select the property.
2. *Settings → Users and permissions → Add user*.
3. Paste the service account's `client_email` (found in the downloaded JSON, looks like `serp-reader@your-project.iam.gserviceaccount.com`).
4. Permission level: **Restricted** (read-only) is enough.

### 3. Configure the server

Set these environment variables where the server runs (locally in `.env`, or in Coolify's environment settings for production):

| Variable | Required | Description |
|---|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | Yes | The **entire contents** of the downloaded JSON key file, as a single-line string. |
| `GSC_SITE_TEPATLASER` | No | Override the Search Console property URL for tepatlaser.com. Defaults to `https://tepatlaser.com/`. Use `sc-domain:tepatlaser.com` instead if it's verified as a Domain property. |
| `GSC_SITE_RAJACUTTING` | No | Same, defaults to `https://rajacuttinglaser.com/`. |
| `GSC_SITE_JASALASERCUTTING` | No | Same, defaults to `https://jasalasercutting.com/`. |
| `GSC_REFRESH_INTERVAL_HOURS` | No | How often the server re-queries Search Console. Defaults to `12`. |
| `NADIA_GSC_CONCURRENCY` | No | Nadia outbound GSC request concurrency. Defaults to `4` and is capped at `5`. |
| `NADIA_MAX_GSC_QUERIES` | No | Maximum unique normalized GSC queries per Nadia analysis run. Defaults to `300`. |

Once `GSC_SERVICE_ACCOUNT_JSON` is set, the server refreshes rankings automatically on
startup and every `GSC_REFRESH_INTERVAL_HOURS` — see the console log for
`✅ [SERP] Search Console refresh done` or `❌ [SERP] Search Console refresh failed`.

Note: Search Console data lags real-time by ~2-3 days, and a keyword only returns a
position if it had at least one impression in the trailing 28-day window — a brand
new page can legitimately show "Belum Ada Data" for a while, that's expected.

---

## 🔒 Security & Authorization

- All `/api/*` endpoints require `Authorization: Bearer <HMAC_TOKEN>` or valid `hq_session_token` cookie.
- `HQ_PASSWORD` and `HQ_AUTH_SECRET` are mandatory. The process fails closed when either is missing or blank; there are no source-code defaults.
- Any credential previously published in repository history must be treated as compromised and rotated; removing a literal from the current tree does not invalidate historical exposure.

---

## 📜 License & Author

- Author: **Ddos-spec** (`setgraph69@gmail.com`)
- Target Organization: **PT Tepat Laser Indonesia**
