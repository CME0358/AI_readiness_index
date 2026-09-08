# ARI-P0-03 Event Dictionary

Canonical measurement taxonomy for readiness.coaretail.com. Repository contract only — live GA4 volumes require GA4 property access.

## GA4 property

| Item | Value |
| --- | --- |
| Measurement ID | `G-BS30YQY1N7` |
| GTM | Not used (gtag.js direct) |
| Cross-domain linker | Not configured |

## Canonical funnel events

| Canonical | Status | Primary GA4 event | Trigger | Not equivalent to |
| --- | --- | --- | --- | --- |
| `landing_view` | implemented | `landing_view` | All pages on DOMContentLoaded | — |
| `service_view` | implemented | `service_view` | Commercial surfaces: `/report/`, `/improve.html`, `/research/`, `/whitepaper/`, `/framework/`, `/oisummit/` | `landing_view` alone |
| `cta_click` | implemented | `cta_click` | Click `[data-funnel-cta]` | lead/booking/purchase |
| `diagnosis_start` | alias | `report_start` | Once per tab when Report diagnosis starts | `cta_click` |
| `diagnosis_complete` | alias | `report_result_view` | Results rendered (`report_form_complete` is pre-result) | `diagnosis_start`, `purchase` |
| `lead_submit_success` | alias | `lead_created` | HTTP 201 from `/api/whitepaper-lead` | `lead_capture_start`, `cta_click` |
| `booking_confirmed` | **not_connected** | `consult_booked` (reserved) | Requires booking webhook; **not** consult CTA click | `partner_consult_cta_click` |
| `purchase` | alias | `purchase_verified` | Stripe verified via `/api/verify-purchase` + `verified: true` | `report_checkout_start` |

## Legacy → canonical map

| Legacy event | Canonical |
| --- | --- |
| `report_start` | `diagnosis_start` |
| `report_result_view` | `diagnosis_complete` |
| `lead_created` | `lead_submit_success` |
| `purchase_verified` | `purchase` |
| `insight_cta_*` | `cta_click` |

Dual-fire: when a primary event fires, the canonical alias fires in the same beat with `canonical_source_event` and `measurement_schema: p0-03`.

## Attribution fields

| Field | Source | Notes |
| --- | --- | --- |
| `source`, `medium`, `campaign` | UTM query + `ari_attribution_v1` | Observed; never infer AI from Direct |
| `firstTouch`, `lastTouch` | `localStorage` `ari_attribution_v1` | Stored separately from self-report |
| `awareness_channel_self_reported` | Optional form select | Self-reported only; not merged into UTM |

### Awareness channel values (optional)

`CHATGPT`, `GEMINI`, `COPILOT`, `PERPLEXITY`, `CLAUDE`, `GROK`, `SEARCH`, `SNS`, `REFERRAL`, `OTHER`

## Dedupe keys (client)

| Event | Key pattern | Storage |
| --- | --- | --- |
| `purchase` / `purchase_verified` | `ari_ga_purchase:{stripe_session_id}` | `localStorage` |
| `lead_submit_success` | `ari_ga_lead_success:{leadId}` | `sessionStorage` |
| `diagnosis_start` | `ari_report_start_sent` | `sessionStorage` |

Server: `ConversionRepository` dedupes `REPORT_PURCHASE` by `externalReference` (Stripe session id).

## Outbound handoffs

| Destination | Mechanism | Booking/purchase proof |
| --- | --- | --- |
| `localgeo.coaretail.com` | Outbound link + UTM (`utm_source=ari_report` etc.) | Local GEO GA — **separate repo/property** |
| `www.coaretail.com/readiness/mtgschedule` | Outbound link | `booking_confirmed` **not_connected** |

## Test traffic separation

Non-production: `localhost`, `127.0.0.1`, `*.vercel.app`, hostname containing `preview`, or `?ari_debug=1`.

Sets `debug_mode: true` and `traffic_type: internal` on gtag config/events.

## PII exclusion

Never send to GA4: `email`, `company`, `domain`, `name`, `note`, `referrer` (raw), `firstTouch`/`lastTouch` objects.

## Source files

- `assets/ga4.js` — base config, `landing_view`, `service_view`, bridge
- `assets/sitewide-cta-tracking.js` — `cta_click`, attribution capture
- `assets/whitepaper-lead-capture.js` — lead funnel
- `report/src/analytics.js` — diagnosis + purchase
- `scripts/lib/measurement/event-dictionary.mjs` — machine-readable dictionary
- `scripts/lib/measurement/canonical-emit.mjs` — alias + dedupe helpers

## GA4 28-day baseline (data request)

**Status: BLOCKED** — no GA4 Data API credentials in this workspace.

Request from analytics owner:

1. Sessions by `source` / `medium` (28d, readiness property)
2. Event counts: `landing_view`, `service_view`, `cta_click`, `diagnosis_start`, `diagnosis_complete`, `lead_submit_success`, `purchase`
3. `REPORT_PURCHASE` conversions (if configured) vs `purchase_verified` events
4. Filter: exclude `traffic_type = internal`

Distinguish **zero volume** (event exists, count=0) from **not measured** (`booking_confirmed`, Local GEO purchase).
