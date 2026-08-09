# RMVU-05J Publication Observation & Measurement

> **Property:** https://readiness.coaretail.com  
> **Status:** Observation templates ready — data entry after GHA publication  
> **Automation:** unchanged (RMVU-05I post-deploy IndexNow ordering)  
> **Created:** 2026-08-09

---

## Overall Result

**MEASUREMENT READY**

Publication / IndexNow receipt is **PARTIAL** in-repo (GHA logs + `schedule.json`); this report provides the canonical fill-in surface. No publisher, schedule, or IndexNow code changes.

---

## 1. Observation Infrastructure Audit

| Source | Role | Classification | Notes |
| --- | --- | --- | --- |
| `insights/_scheduled/schedule.json` | `publishAt`, `status`, `publishedAt` | **SUFFICIENT** | Authoritative publication state after GHA commit |
| GHA `publish-scheduled-insights` run log | `Published:`, `UPDATED=1`, prepare/publish steps | **SUFFICIENT** | Run URL: GitHub Actions → Publish scheduled Insights |
| GHA Post-deploy IndexNow step | JSON `{ status, submitted, httpStatus, deferred, blocked }` | **SUFFICIENT** | Submission receipt only — not indexing proof |
| GHA console (`IndexNow production gate PASS`, `INDEXNOW_FAILED`) | HTTP 200 gate + API outcome | **SUFFICIENT** | Copy into §4 per article |
| `reports/Organic Search Weekly Baseline.md` | Site GSC + GA4 funnel template | **SUFFICIENT** | Weekly site-level; link from §6 |
| `reports/rmvu-05h-priority-release.md` | Current Event context + measurement bullets | **PARTIAL** | Plan only; no per-window tables |
| Persistent IndexNow log file in repo | — | **INSUFFICIENT** | Not required; GHA log is source of truth |
| Search Console API / DB | — | **INSUFFICIENT** | Out of scope (manual export) |
| `assets/ga4.js` + `assets/analytics.js` | Base + CTA events | **SUFFICIENT** | Pre-validated in scheduled HTML |
| Social attribution | — | **N/A** | Social not published; do not assume social traffic |

**Receipt workflow (manual, post-GHA):**

1. Open GHA run for publication date → copy `Published:` slugs + IndexNow JSON.
2. Verify `schedule.json` on `main` after commit (`status: published`, `publishedAt` set).
3. `curl -I` production URL → HTTP status.
4. Fill §2 receipt row + §3 or §4 observation checklist.
5. At 24h / 72h / 7d → GSC + GA4 → fill §6–§8 (TBD until data exists).

---

## 2. Canonical Publication Receipt

Per-article record (copy block for each release):

| Field | three-pillars-ops | cloudflare-aeo |
| --- | --- | --- |
| **slug** | three-pillars-ops | cloudflare-aeo |
| **scheduled_at** | 2026-08-10T10:00:00+09:00 | 2026-08-11T10:00:00+09:00 |
| **published_at** | TBD | TBD |
| **production_url** | https://readiness.coaretail.com/insights/three-pillars-ops/ | https://readiness.coaretail.com/insights/cloudflare-aeo/ |
| **production_http_status** | TBD (expect 200 after deploy) | TBD |
| **canonical_status** | TBD (expect matches production_url) | TBD |
| **sitemap_status** | TBD (expect present in sitemap.xml) | TBD |
| **indexable_status** | TBD (expect indexable, no noindex) | TBD |
| **indexnow_status** | TBD (`success` / `accepted` / `deferred` / `skipped`) | TBD |
| **indexnow_response** | TBD (HTTP code from API; JSON from GHA step) | TBD |
| **indexnow_post_deploy_gate** | TBD (expect PASS after HTTP 200) | TBD |
| **ga4_tracking_status** | TBD (ga4.js + analytics.js present) | TBD |
| **cta_tracking_status** | TBD (`data-ga-insight-cta` on CTAs) | TBD |
| **gha_run_url** | TBD | TBD |
| **commit_hash** | TBD | TBD |

---

## 3. Aug 10 Observation — three-pillars-ops

**Expected publication:** 2026-08-10 10:00 JST (GHA may run later; use actual `publishedAt`)

**Pre-publication (2026-08-09 verified):**

| Check | Expected | Current |
| --- | --- | --- |
| schedule status | scheduled | scheduled |
| production URL | unpublished | HTTP 404 |
| IndexNow | blocked / not run | blocked (future) |

**Post-GHA checklist** (fill after run completes):

| # | Check | Pass | Evidence |
| ---: | --- | :---: | --- |
| 1 | `schedule.json` status = `published` | ☐ | |
| 2 | `publishedAt` present (ISO) | ☐ | |
| 3 | production URL HTTP 200 | ☐ | |
| 4 | canonical = production URL | ☐ | |
| 5 | sitemap contains URL (no `_scheduled/`) | ☐ | |
| 6 | page indexable (no noindex) | ☐ | |
| 7 | IndexNow ran **after** HTTP 200 (GHA step order) | ☐ | |
| 8 | IndexNow response recorded in GHA JSON | ☐ | |
| 9 | GA4 base tracking (`ga4.js`, `analytics.js`) | ☐ | pre-publish: present in `_scheduled` HTML |
| 10 | no ABIS exposure | ☐ | pre-publish: no protected slug |

**Series:** Evergreen v2  
**Primary CTA events:** `insight_cta_framework`, `insight_cta_research`, `insight_cta_report`

---

## 4. Aug 11 Observation — cloudflare-aeo

**Expected publication:** 2026-08-11 10:00 JST

**Pre-publication (2026-08-09 verified):**

| Check | Expected | Current |
| --- | --- | --- |
| schedule status | scheduled | scheduled |
| series | current-event | current-event |
| priority | P1 | P1 |
| production URL | unpublished | HTTP 404 |
| premature publication | none | none (404) |
| IndexNow | blocked | blocked (`future_publishAt`) |

**Post-GHA checklist:**

| # | Check | Pass | Evidence |
| ---: | --- | :---: | --- |
| 1 | status = `published` | ☐ | |
| 2 | production URL HTTP 200 | ☐ | |
| 3 | article publicly accessible | ☐ | |
| 4 | canonical correct | ☐ | |
| 5 | BlogPosting JSON-LD valid | ☐ | |
| 6 | sitemap entry exists | ☐ | |
| 7 | IndexNow post-deploy (after HTTP 200) | ☐ | |
| 8 | no premature publication before slot | ☐ | |
| 9 | report CTA → `/report/` + `data-ga-insight-cta="report"` | ☐ | pre-publish: verified |
| 10 | GA4 hooks present | ☐ | pre-publish: verified |
| 11 | ABIS absent | ☐ | |
| 12 | Current Event metadata (`editorialType`, `articleSection`) | ☐ | pre-publish: `current_event` / Current Event |

**RMVU-05H reference:** [[rmvu-05h-priority-release]] — Score 77, displaced `ari-vs-geo-seo` to Aug 12 slot.

---

## 5. IndexNow Receipt

> IndexNow HTTP 200/202 = **submission receipt only**. Not equivalent to Google indexing.

| Article | Submitted | API HTTP | Gate (prod 200) | Deferred | Notes |
| --- | :---: | --- | :---: | :---: | --- |
| three-pillars-ops | TBD | TBD | TBD | TBD | |
| cloudflare-aeo | TBD | TBD | TBD | TBD | |

**Indexation (observe separately, no automation):**

| Article | IndexNow Submitted | Google Indexed | First Impression |
| --- | :---: | --- | --- |
| three-pillars-ops | TBD | UNKNOWN | UNKNOWN |
| cloudflare-aeo | TBD | UNKNOWN | UNKNOWN |

---

## 6. GSC Measurement — cloudflare-aeo

Manual export from Search Console (page filter: `/insights/cloudflare-aeo/`).  
Site-wide weekly template: [[Organic Search Weekly Baseline]].

### 24h window

| Metric | Value |
| --- | ---: |
| impressions | TBD |
| clicks | TBD |
| CTR | TBD |
| average position | TBD |

**Top queries (page):**

| query | impressions | clicks | CTR | position |
| --- | ---: | ---: | ---: | ---: |
| TBD | | | | |

### 72h window

| Metric | Value |
| --- | ---: |
| impressions | TBD |
| clicks | TBD |
| CTR | TBD |
| average position | TBD |

### 7d window

| Metric | Value |
| --- | ---: |
| impressions | TBD |
| clicks | TBD |
| CTR | TBD |
| average position | TBD |

---

## 7. GA4 Measurement — cloudflare-aeo

**Measurement ID:** `G-BS30YQY1N7`

### 24h / 72h / 7d

| Window | landing_sessions | insight_cta_report | report_start |
| --- | ---: | ---: | ---: |
| 24h | TBD | TBD | TBD |
| 72h | TBD | TBD | TBD |
| 7d | TBD | TBD | TBD |

---

## 8. Funnel — cloudflare-aeo

```
Article landing (/insights/cloudflare-aeo/)
  ↓ insight_cta_report
/report/
  ↓ report_start
```

| Metric | 24h | 72h | 7d |
| --- | ---: | ---: | ---: |
| landing_sessions | TBD | TBD | TBD |
| insight_cta_report (clicks) | TBD | TBD | TBD |
| report_start | TBD | TBD | TBD |
| CTA rate (cta / landing) | TBD | TBD | TBD |

Calculate CTA rate only when both numerator and denominator exist.

---

## 9. Source Attribution — cloudflare-aeo

| Source | 24h | 72h | 7d | Notes |
| --- | ---: | ---: | ---: | --- |
| organic search | TBD | TBD | TBD | |
| direct | TBD | TBD | TBD | |
| referral | TBD | TBD | TBD | |
| social | TBD | TBD | TBD | do not assume; social not published |
| other | TBD | TBD | TBD | |

---

## 10. Comparison — Current Event vs Evergreen

Normalized windows only (first 24h / 72h / 7d from each article's `publishedAt`).

### Primary pair

| Metric | cloudflare-aeo (Current Event) | three-pillars-ops (Evergreen) |
| --- | ---: | ---: |
| **24h impressions** | TBD | TBD |
| **24h clicks** | TBD | TBD |
| **24h CTR** | TBD | TBD |
| **24h landing_sessions** | TBD | TBD |
| **72h impressions** | TBD | TBD |
| **72h clicks** | TBD | TBD |
| **72h landing_sessions** | TBD | TBD |
| **7d impressions** | TBD | TBD |
| **7d clicks** | TBD | TBD |
| **7d landing_sessions** | TBD | TBD |

**Secondary (cloudflare-aeo only unless noted):**

| Event | 72h | 7d |
| --- | ---: | ---: |
| insight_cta_report | TBD | TBD |
| report_start | TBD | TBD |

### Later comparison (after Aug 12 publish)

| Metric | cloudflare-aeo | ari-vs-geo-seo |
| --- | ---: | ---: |
| first 72h landing_sessions | TBD | TBD |
| first 7d impressions | TBD | TBD |

Do not claim causality from a single article pair.

---

## 11. Current Event Success Criteria (72h classification)

Classify **cloudflare-aeo** after 72h data entry:

| Class | Guidance |
| --- | --- |
| **STRONG SIGNAL** | Meaningful GSC impressions + GA4 landing + CTA engagement vs Evergreen baseline |
| **PROMISING** | Discovery or traffic signal without full funnel |
| **NEUTRAL** | Traffic flat; no clear lift vs comparable Evergreen window |
| **WEAK SIGNAL** | Minimal impressions and sessions |
| **INSUFFICIENT DATA** | GSC/GA4 too sparse to classify |

**72h classification:** TBD

Evidence notes: TBD

---

## 12. Editorial Intelligence Feedback (post 72h)

Pipeline selection for cloudflare-aeo: **P1**, score **77** (RMVU-05H).

| Evaluation | TBD after 72h |
| --- | --- |
| Selection quality | GOOD / ACCEPTABLE / WEAK / INSUFFICIENT DATA |

Consider: search discovery, landing traffic, CTA engagement, editorial relevance.

**Threshold policy (unchanged):**

| Band | Score |
| --- | --- |
| P0 | 80+ |
| P1 | 65–79 |
| P2 | 50–64 |

Do **not** change P0/P1 thresholds from one article.

---

## 13. RMVU-05B Decision Rule

**Status:** DEFER until `cloudflare-aeo` is legitimately published.

After publication + 72h observation:

| Condition | Action |
| --- | --- |
| Another P0/P1 Current Event in queue | Current Event queue remains priority |
| No P0/P1 Current Event | RMVU-05B Evergreen resumes |
| Next planned Evergreen | `ari-vs-geo-seo` — Aug 12 slot (via unlock slot-skip) |

Schedule unchanged in RMVU-05J.

---

## 14. three-pillars-ops Measurement (Evergreen baseline)

Use same GSC/GA4 windows for comparison (§10). Optional standalone notes:

| Window | impressions | clicks | landing_sessions |
| --- | ---: | ---: | ---: |
| 24h | TBD | TBD | TBD |
| 72h | TBD | TBD | TBD |
| 7d | TBD | TBD | TBD |

---

## Update History

- 2026-08-09: RMVU-05J templates created. Pre-publication state verified (both URLs 404, scheduled). Awaiting Aug 10/11 GHA runs.

## Final Declaration

**RMVU-05J: MEASUREMENT READY**
