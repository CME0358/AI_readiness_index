# Organic Search Weekly Baseline

> **RMVU-05A** — 手動 Search Console 週次計測テンプレート  
> **Property:** `https://readiness.coaretail.com/`  
> **Baseline status:** Not Yet Recorded（初回 GSC エクスポート後に入力）

---

## Report Date

YYYY-MM-DD

## Period

| | Start | End |
|---|---|---|
| **Current** | | |
| **Previous** | | |

---

## Site Metrics

| Metric | Current | Previous | Change |
|---|---:|---:|---:|
| Total Clicks | TBD | TBD | |
| Total Impressions | TBD | TBD | |
| CTR | TBD | TBD | |
| Average Position | TBD | TBD | |

---

## Top Queries

| Query | Clicks | Impressions | CTR | Position | Cluster | Change |
|---|---:|---:|---:|---:|---|---|
| | | | | | | |

### Cluster Key

| Code | Intent |
|---|---|
| A | AI Search Basics |
| B | ChatGPT Recommendation |
| C | Machine Readability |
| D | Recommendation / Trust |
| E | Actionability |
| F | Business Decision |

---

## Top Pages

| Landing Page | Clicks | Impressions | CTR | Position | Role | Change |
|---|---:|---:|---:|---:|---|---|
| | | | | | | |

### Role Key

| Role | Examples |
|---|---|
| TRAFFIC | llms-txt, ari-vs-geo-seo, faq-for-agents |
| MONEY-ADJACENT | blind, readiness-baseline, execution-readiness |
| AUTHORITY | research, framework, evidence |
| CONVERSION | /report/, whitepaper Company Report |
| SUPPORT | methodology, insights index |

---

## Newly Indexed Pages

| URL | Index status | Publish date |
|---|---|---|
| | | |

---

## Opportunity Review

| Signal | Action |
|---|---|
| High impressions + Low CTR | title / meta review |
| Position 8–20 | content / evidence / internal-link review |
| High traffic + Low Report CTA | conversion bridge review（money-adjacent 記事） |
| No impressions | intent mismatch / indexing / consolidation review |

---

## GA4 Organic Conversion Funnel

**Measurement ID:** `G-BS30YQY1N7`

### Funnel (documentation only — event names unchanged)

```
Organic session
  ↓
Insight landing (/insights/)
  ↓ insight_cta_report
report_start
  ↓
report_form_complete
  ↓
report_checkout_start
  ↓
purchase_verified
```

### GA4 Exploration Recommendation

1. **Explore → Funnel exploration**
2. **Segment:** Session source / medium = organic（または Organic Search）
3. **Landing page filter:** `/insights/` を含む
4. **Steps:**
   - `session_start`（または `page_view` on `/insights/*`）
   - `insight_cta_report`
   - `report_start`
   - `report_form_complete`
   - `report_checkout_start`
   - `purchase_verified`

### Weekly GA4 Notes (optional)

| Metric | Current week | Previous week |
|---|---:|---:|
| Organic sessions | TBD | TBD |
| insight_cta_report (from /insights/) | TBD | TBD |
| report_start | TBD | TBD |
| purchase_verified | TBD | TBD |

---

## Planning References (not guarantees)

RMVU-05 audit planning references — **baseline取得後にのみ target を設定**:

- Impressions trend: review after 4 weekly entries
- insight_cta_report: review after baseline
- Organic → purchase_verified CVR: review after baseline

---

## Update History

- 2026-08-09: RMVU-05A template created. Baseline not yet recorded.
