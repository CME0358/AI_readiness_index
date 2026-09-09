# ARI-P0-03 Event Dictionary

Canonical measurement taxonomy for readiness.coaretail.com. Repository contract only — live GA4 volumes require GA4 property access.

## GA4 property

| Item | Value |
| --- | --- |
| Migration state | `DUAL_TAG_VALIDATION` |
| Legacy shared Measurement ID | `G-BS30YQY1N7` — portfolio property (QOLmedia, coaretail LP, Local GEO shared tag, etc.). **Not ARI-only.** Retained during validation. |
| Dedicated ARI Measurement ID | `G-RGP8XZHK5V` — `readiness.coaretail.com` only (stream: Agent Readiness Web) |
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

---

## GA4_IMPLEMENTATION_MAP（2026-09-10 監査）

### Property & tag stack

| Layer | Implementation | Notes |
| --- | --- | --- |
| Migration state | `DUAL_TAG_VALIDATION` | Validation window: 7–21 days before legacy ID removal from ARI |
| Legacy shared ID | `G-BS30YQY1N7` | Portfolio shared property — historical data preserved; not ARI-only |
| Dedicated ARI ID | `G-RGP8XZHK5V` | New property for `readiness.coaretail.com` only |
| Event routing | Dual `gtag('config')` + central `send_to` on custom events | All ARI custom events route to **both** IDs via `assets/ga4.js` wrapper |
| Loader | `assets/ga4.js` via `<script async>` on all public HTML | Injects `gtag/js`; **no GTM**, **no Consent Mode**, **no MP/server-side** |
| Cross-domain linker | Not configured | `localgeo` / `www.coaretail.com` = outbound UTM links only |

### Event emitters (by surface)

| File | Events | Session attribution role |
| --- | --- | --- |
| `assets/ga4.js` | `page_view` (via config), `landing_view`, `service_view`, alias bridge | **Primary session anchor** |
| `assets/sitewide-cta-tracking.js` | `cta_click`, `cta_impression` | Sends event params `source`/`medium`/`campaign` from URL (empty if no UTM). **Does not set session source.** |
| `assets/analytics.js` | `insight_cta_framework` / `_research` / `_report` | Legacy; coexists with sitewide CTA on many Insights |
| `assets/homepage-public-check.js` | `check_impression`, `check_start`, `check_result` | Homepage Quick Check; no UTM params |
| `report/src/analytics.js` (Vite bundle) | `report_start`, `purchase_verified`, preview funnel, etc. | Reads `ari_attribution_v1` localStorage for event params |
| `assets/whitepaper-lead-capture.js` | `lead_created`, routing events | Lead funnel |
| `assets/partner-qualification.js` | `partner_*`, `conversion` | Post-purchase |
| `assets/oisummit-analytics.js` | OISummit funnel | Sub-brand surface |

### Attribution persistence (client)

| Store | Key | Scope | GA4 sent? |
| --- | --- | --- | --- |
| `localStorage` | `ari_attribution_v1` | firstTouch / lastTouch from UTM + referrer at CTA or page load | **No** (objects stripped). Event params `source`/`medium`/`campaign` only on select events |
| `sessionStorage` | dedupe keys | per-tab | N/A |
| `localStorage` | `ari_conversion_log_v1` | conversion log | N/A |

### `/go/` short URL

| Manifest | Handler | UTM |
| --- | --- | --- |
| `insights/_social/x-sidecar/redirects.json` | `api/go/[short_id].js` → 302 | `utm_source=x&utm_medium=organic&utm_campaign=ari_x_traffic&utm_content={YYMMDD}_{slot}` |
| `insights/_social/referral/redirects.json` | same handler | `utm_source=referral&utm_medium=outbound\|partner&utm_campaign=ari_ref_*` |

Production verified 2026-09-10: `/go/x260908d` → 302 with full UTM query preserved.

### Conversion path (measurable today)

```
Traffic (session source/medium from first page_view)
  → landing_view (all pages)
  → service_view (commercial paths only)
  → cta_click / insight_cta_* / check_*
  → report_start (+ diagnosis_start alias)
  → report_form_complete → report_result_view (+ diagnosis_complete alias)
  → report_checkout_start → purchase_verified (+ purchase alias)
Outbound: localgeo (UTM outbound) · mtgschedule (booking_confirmed NOT_CONNECTED)
```

### Pages missing `sitewide-cta-tracking.js` (attribution capture gap)

`exec-readiness-kpi`, `multi-agent-compare`, `mcp-business-api`, `marketing-info-design`, `agent-handoff`, `ai-agent-marketing-shift` — GA4 loads but **no** `rememberTouch()` on landing. Session source still from `page_view`; last-touch localStorage may be empty until CTA click on another page.

### Buffer / SNS UTM governance (current)

| Channel | exec-readiness-kpi (2026-09-08) | x-sidecar |
| --- | --- | --- |
| Facebook / LinkedIn / X | Direct article URL, **no UTM** → `facebook.com/referral` etc. | `/go/{short_id}` → UTM preserved |
| Buffer as source | Not used (correct) | N/A |

### 2026-09-09 (not set) audit notes

- **No git commits dated 2026-09-09** in repo. Spike aligns with **2026-09-08 deploy** (P0-03 measurement, P1-03 Quick Check, P2-01 guides, P3-01 cases/referral) + **exec-readiness-kpi** Buffer publish (9/8 JST).
- **Primary technical suspect (P0):** `ga4.js` fires `landing_view`/`service_view` on `DOMContentLoaded` while `gtag/js` loads async — risk of event-first sessions → `(not set)` if `page_view` not processed first. **Requires DebugView confirmation.**
- **Reporting sanity check:** User-reported session total (35) < sum of (not set)+direct (50) — reconcile in GA4 before patching.
- **MANUAL GA4 VERIFICATION REQUIRED** for root-cause confirmation (no Data API in workspace).
