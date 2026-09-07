# Phase 9E Revenue Measurement Specification

This is a repository-level measurement contract. It does not claim live GA4,
Stripe, Airtable, Local GEO, or Search Console results.

## Truth hierarchy

1. Visit or impression
2. CTA interaction
3. Check
4. Lead or route
5. Verified purchase
6. Qualification
7. Consultation click

Only a server-verified Stripe Company Report purchase is revenue.
Local clicks, routing events, qualification, and consultation clicks are not
revenue.

## Reporting views

| View | Metric | Event source | Conversion source | Attribution | Limitation |
| --- | --- | --- | --- | --- | --- |
| Revenue Funnel | sessions → Check → Report checkout → verified purchase | `landing_view`, `check_start`, `check_result`, `report_checkout_start` | `REPORT_PURCHASE` | source, campaign, insight slug, editorial intent | does not prove causality |
| Editorial Intent Performance | sessions, Check CTR, Report CTR, Local CTR, purchases | landing/CTA events | `REPORT_PURCHASE` | `editorial_intent` | requires sufficient observation volume |
| Insight Performance | article sessions and CTA outcomes | `landing_view`, `cta_impression`, `cta_click` | downstream verified purchase where attribution survives | `insight_slug`, `cta_id`, `cta_type` | cross-session storage may be unavailable |
| Report Conversion | proof → checkout → purchase | `report_proof_impression`, `report_checkout_start` | `REPORT_PURCHASE` | stored attribution and Stripe session | checkout is not purchase |
| Local Handoff | eligible commercial sessions → Local click | `local_cta_click` | none | CTA/source attribution | no Local contract or revenue evidence |
| Qualified Partner Funnel | qualification → consult click | `partner_qualification_complete`, `partner_consult_cta_click` | `PARTNER_QUALIFIED`, `CONSULT_CLICK` | lead/purchase and attribution where supported | neither event proves revenue |

## KPI formulas

- Homepage Check start rate = `check_start / eligible Homepage sessions`
- Check completion rate = `check_result / check_start`
- Insight Check CTR = `Insight CHECK clicks / eligible Insight sessions`
- Report arrival rate = `CHECK-attributed Report arrivals / check_result`
- Report checkout rate = `report_checkout_start / Report sessions`
- `PROOF_TO_CHECKOUT_RATE` = `report_checkout_start / sessions with report_proof_impression`
- Report purchase CVR = `verified REPORT_PURCHASE / Report sessions`
- Local handoff rate = `local_cta_click / eligible commercial sessions`
- Qualified partner rate = `(HIGH + MEDIUM) / explicitly stated denominator`
- Consult click rate = `CONSULT_CLICK / HIGH + MEDIUM qualified leads`
- `REPORT_REVENUE` = stored verified `REPORT_PURCHASE.value` in JPY; fallback is verified count × ¥29,800 tax excl.

Denominators must be reported explicitly and never mixed silently.

## Observation window

Minimum: **7 days**. Preferred: **14 days**.

Observe commercial-intent sessions, Check starts/completions, Report arrivals,
proof views, checkout starts, verified purchases, Local handoffs, qualified
partner events, and consultation clicks. No uplift target is assumed.

## External validation limits

- GA4 repository configuration is auditable; production metrics require GA4 access.
- Search Console data requires external account validation.
- Local GEO revenue and Advisory revenue require downstream systems and are not inferred here.
