# Agent Readiness Index — Design System

> **Canonical visual specification** for the public Agent Readiness Research Hub (`readiness.coaretail.com`).
> Read this document before modifying any public UI.
>
> Last audited: 2026-08-09 · Scope: `/`, `/report/`, `/improve.html`, `/research/`, `/framework/`, `/whitepaper/`, `/insights/`, `/methodology.html`

---

## 0. Brand Positioning

**Visual identity:** Research × Business Intelligence × Enterprise AI

**Desired impression:** credible · analytical · calm · premium · precise · modern · decision-oriented

**Avoid:** generic AI startup aesthetics · excessive gradients · neon · glassmorphism · playful consumer SaaS · oversized rounded cards · heavy drop shadows · flashy motion · fake futuristic UI · fake urgency · certification visuals

**Product truth (copy guardrails):** Advisory is ongoing improvement support — not certification, not outcome guarantee. ABIS is never exposed in public UI.

---

## 1. Design Principles

1. **Evidence over decoration** — Visual weight follows data, interpretation, and decision clarity.
2. **Hierarchy over density** — One primary message per section; whitespace is a decision tool.
3. **Restraint over novelty** — Prefer established hub patterns over one-off styling.
4. **Decision clarity over feature display** — Reports and pricing exist to help buyers choose the next action.
5. **Enterprise trust over startup hype** — Monochrome base, restrained accent, no artificial scarcity.

---

## 2. Current UI Audit (2026-08-09)

### What is already strong (keep)

| Pattern | Where | Notes |
| --- | --- | --- |
| Inter + JP system stack | Hub pages (`index`, `framework`, `research`, `insights`, `methodology`) | Readable mixed JP/Latin |
| `:root` CSS variables | Most static HTML pages | Good foundation for token migration |
| `--max: 1120px` container | Homepage, Framework, Research, Insights hub | Consistent enterprise width |
| Sticky blur nav (64px) | Hub pages | Calm, credible header |
| Section eyebrow + H2 + lead | Hub sections | Clear editorial hierarchy |
| Reading width ~640–720px | Insights articles, hub `.lead` / `.body-text` | Appropriate for long copy |
| 1px subtle borders | Cards across hub | No heavy SaaS shadows (mostly) |
| Black primary CTA (`#09090B`) | Hub nav-cta, `.btn-primary` | Enterprise default |
| Evidence → interpretation flow | Report SPA structure | Align visuals to this sequence |
| 3-column Advisory pricing | `/improve.html` | Strong comparison UX (content done; tokens need alignment) |

### What is inconsistent (normalize over time)

| Issue | Examples | Canonical direction |
| --- | --- | --- |
| **Accent color drift** | Home `#1B56B0`, Framework `#0D7377`, Improve/Report `#16A34A`, Whitepaper/Report CTA `#06C755` | See §5 — one brand accent + semantic greens |
| **Container width drift** | Improve: 720px / 1080px; Hub: 1120px; Insights article: 720px | See §2 Layout |
| **Section rhythm drift** | Improve 48px; Framework 72px; Home/Research 96–100px | See §3 Spacing |
| **Typography weight drift** | Hub 400–600; Improve 400–800; Report inline styles | Limit to 400 / 500 / 600 / 700 |
| **Inline CSS duplication** | Every page re-declares `:root` | Adopt `assets/design-system.css` incrementally |
| **Navigation variants** | Improve: minimal back-nav; Hub: full nav + CTA | Contextual but share tokens/components |
| **Footer variants** | Improve: dark minimal; Hub: `research-footer` layered links | Unify footer pattern |
| **Button hover motion** | Some pages `translateY(-1px)` + shadow | Minimal hover only (§16) |
| **Card shadow on hover** | Whitepaper report cards | Border emphasis only |
| **Legacy animation** | `hub-animations.css` hero/reveal | Allowed sparingly on marketing hero only |

**Do not fix all pages in one pass.** Migrate when a page is already being edited.

---

## 3. Layout

### Width tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--container-max` | `1120px` | Default site shell (hub, framework, research landing) |
| `--container-reading` | `720px` | Long-form prose, article body, narrow landing sections |
| `--container-wide` | `1120px` | Pricing comparison, data grids, report tables (same as max unless full-bleed) |
| `--container-gutter` | `24px` | Horizontal padding (16px only if mobile constraint requires) |

**Hero:** full container width with generous vertical padding (`calc(var(--nav-height) + 56–80px)` top, `48–88px` bottom).

**Rule:** Do not place long Japanese paragraphs in 1120px single-column text blocks.

### Section vertical rhythm

| Context | Padding (Y) |
| --- | --- |
| Major hub section | `96px` (can reduce to `72px` on subpages) |
| Compact landing section (Advisory) | `64px` minimum |
| Section with dense comparison (pricing) | `72–96px` |
| Footer | `48px` top / `32px` bottom |

### Grid gaps

| Context | Gap |
| --- | --- |
| Card grid (2-col) | `16px` |
| Card grid (3-col pricing) | `20px` (16px on narrow desktop) |
| Ladder / list steps | `10–12px` |

### Breakpoints

| Name | Min width | Behavior |
| --- | --- | --- |
| `sm` | — | Single column default |
| `md` | `768px` | 2-column where defined |
| `lg` | `960px` | Pricing 3-col → 1-col at **max 960px** |
| `xl` | `1120px` | Full container |

**Mobile rule:** Re-stack intentionally. No horizontal scroll for pricing, tables, or nav.

---

## 4. Spacing Scale

Use this scale only. Avoid arbitrary values (`37px`, `53px`, etc.) unless matching existing compiled assets.

| Token | px | Preferred usage |
| --- | --- | --- |
| `--space-1` | 4 | Icon gaps, tight inline spacing |
| `--space-2` | 8 | List item padding, badge padding Y |
| `--space-3` | 12 | Compact card padding, button padding Y (small) |
| `--space-4` | 16 | Default paragraph gap, card padding, grid gap (compact) |
| `--space-5` | 24 | Section sub-blocks, card padding (standard), grid gap |
| `--space-6` | 32 | Shared CTA block padding, section header margin |
| `--space-7` | 48 | Section padding (compact), hero bottom |
| `--space-8` | 64 | Hero top offset companion, section padding |
| `--space-9` | 80 | Large hero padding |
| `--space-10` | 96 | Major section padding |
| `--space-11` | 128 | Rare — homepage hero emphasis only |

---

## 5. Typography

### Font stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Hiragino Sans', 'Noto Sans JP', sans-serif;
```

**Weights to load:** 400, 500, 600, 700 — avoid 800 except large display numerals.

### Type roles

| Role | Size | Weight | Line-height | Letter-spacing | Notes |
| --- | --- | --- | --- | --- | --- |
| **Display** | `clamp(2rem, 4.5vw, 3.25rem)` | 600–700 | 1.15–1.2 | `-0.03em` | Homepage hero only |
| **H1** | `clamp(1.75rem, 4vw, 2.75rem)` | 600–700 | 1.15–1.25 | `-0.02em` to `-0.03em` | Page titles |
| **H2** | `clamp(1.375rem, 2.5vw, 1.75rem)` | 600 | 1.2 | `-0.02em` | Section headings |
| **H3** | `1.0625–1.125rem` | 600 | 1.3 | `-0.01em` | Card titles, subsections |
| **Body** | `16px` (hub) / `17px` (Insights articles) | 400 | 1.65–1.85 | `0` | Japanese body — **no wide tracking** |
| **Small** | `13–14px` | 400–500 | 1.55–1.65 | `0` | Meta, notes, qualification |
| **Eyebrow** | `12–13px` | 500–600 | 1.2 | `0.06–0.08em` | Uppercase English labels only |
| **Metric** | `20–28px` | 700–800 | 1.1 | `-0.02em` | Scores, KPIs |
| **Price** | `20–28px` | 700–800 | 1.1 | `-0.02em` | Always pair with contract/terms nearby |

### Japanese + Latin rules

- Japanese headings: minimal letter-spacing; rely on weight and size for hierarchy.
- English eyebrows: tracking allowed (`0.08em`).
- Mixed JP/EN lines: keep Inter; do not add a second display font.
- Large numbers (scores, prices): may be heavier than surrounding text.
- Max **two weights** in a single card block (e.g., 600 title + 400 body).

---

## 6. Color System

Derived from existing hub audit. Use **semantic tokens**, not raw hex in new work.

### Neutrals (primary palette)

| Token | Value | Usage |
| --- | --- | --- |
| `--color-text-primary` | `#09090B` | Headings, primary body |
| `--color-text-secondary` | `#52525B` | Supporting copy, descriptions |
| `--color-text-muted` | `#71717A` | Eyebrows, meta, footer |
| `--color-border` | `rgba(0, 0, 0, 0.08)` | Default borders |
| `--color-border-strong` | `rgba(0, 0, 0, 0.16)` | Hover borders |
| `--color-surface` | `#FFFFFF` | Page background |
| `--color-surface-subtle` | `#FAFAFA` | Alt sections |
| `--color-surface-muted` | `#F4F4F5` | Tags, inactive chips |

### Accent (brand — restrained)

| Token | Value | Usage |
| --- | --- | --- |
| `--color-accent` | `#1B56B0` | Links, hub hero emphasis, focus rings, informational highlight |
| `--color-accent-soft` | `rgba(27, 86, 176, 0.08)` | Hero glow, soft highlights |

**Do not introduce new accent hues per page.** Framework teal (`#0D7377`) is legacy — map to `--color-accent` on next edit.

### Semantic

| Token | Value | Usage |
| --- | --- | --- |
| `--color-cta` | `#09090B` | Primary button fill |
| `--color-cta-hover` | `#27272A` | Primary button hover |
| `--color-success` | `#16A34A` | Pass states, positive metrics, Readiness emphasis |
| `--color-success-soft` | `#F0FDF4` | Success backgrounds |
| `--color-warning` | `#CA8A04` | Partial / caution |
| `--color-danger` | `#DC2626` | Fail states |
| `--color-action-line` | `#06C755` | **Report fulfillment CTA only** (LINE green — product rule) |

### Pricing highlight

Recommended plan: `--color-success` border (2px) + `--color-success-soft` surface — **not** saturated badge-heavy SaaS styling.

---

## 7. Borders, Radius, Shadows

| Element | Border | Radius | Shadow |
| --- | --- | --- | --- |
| Default card | `1px solid var(--color-border)` | `12px` (`--radius-md`) | none |
| Large card / pricing | `1px` or `2px` (primary) | `16px` (`--radius-lg`) | none (primary: optional `0 1px 3px rgba(0,0,0,0.06)`) |
| Button | none or `1px` (secondary) | `8–10px` | none |
| Badge / pill | `1px` optional | `20px` (pill) | none |
| Input / qualification box | `1px solid var(--color-border)` | `10px` | none |

**Prohibited:** `box-shadow: 0 8px 24px…` on hover (Whitepaper legacy) · large colored glows · glass blur except nav (`backdrop-filter` on sticky nav is allowed).

---

## 8. Cards

Use cards only when grouping related decision information.

| Type | Purpose | Typical contents |
| --- | --- | --- |
| **Information** | Explain a concept | Title, body, optional link |
| **Metric** | Show a score/KPI | Large number, label, context |
| **Comparison** | Contrast options | Row/column labels, aligned values |
| **Pricing** | Plan selection | Price, contract, scope, fit, one CTA |
| **Evidence** | Cite research/data | Source, finding, link to methodology |
| **CTA** | Single next step | Short copy + one primary button |

**Not every section should be a card.** Plain prose sections remain valid.

---

## 9. Buttons & Links

### Hierarchy

| Type | Style | Rule |
| --- | --- | --- |
| **Primary** | Filled `--color-cta`, white text | **One** dominant action per section |
| **Secondary** | White/transparent + border | Supporting action |
| **Text link** | Underline on hover, `--color-text-secondary` → primary | Inline navigation |

### Sizing

| Type | Min height | Padding | Font |
| --- | --- | --- | --- |
| Primary | `48px` | `14px 32px` | 15px / 600–700 |
| Secondary | `44px` | `12px 20px` | 14px / 500–600 |
| Nav CTA | `36px` | `8px 14px` | 13px / 500 |

**Pricing cards:** Primary plan may use filled CTA; secondary plans use outline CTAs — never three equally strong filled buttons.

---

## 10. Pricing UI

Canonical Advisory tiers (business-fixed — do not change in design work):

| Plan | Price |
| --- | --- |
| Agent Readiness Advisory | 月額 ¥198,000〜（税別）· 12ヶ月契約 |
| Implementation Design | 月額 ¥250,000〜¥300,000程度（税別） |
| Managed Implementation | 月額 ¥300,000〜（税別） |

**CTA URL (fixed):** `https://www.coaretail.com/readiness/mtgschedule`

### Visual rules

- Price is the dominant typographic element in each card.
- Plan role visible immediately (label + optional `Decide / Review` style tag).
- Included scope: scannable list, not dense paragraphs.
- Recommended plan: subtle emphasis (border + soft background + small badge).
- No fake discounts, countdowns, or "limited offer".
- Monthly price and contract terms must appear together for Advisory.
- Comparison layout: 3 equal-height columns desktop → stacked mobile.

Reference implementation: `/improve.html` pricing grid (structure KEEP; tokens REFINE).

---

## 11. Metrics & Report UI (`/report/`)

**Sequence:** Evidence → Interpretation → Decision

| Layer | Visual treatment |
| --- | --- |
| Evidence | Tables, pass/partial/fail badges, raw scores |
| Interpretation | Summary prose, breakdown bars, AI recognition grid |
| Decision | Priorities, fulfillment CTAs, Advisory link |

- Large score typography for headline metric.
- Supporting context in `--color-text-secondary`.
- Status colors: success / warning / danger tokens only.
- Avoid decorative dashboard chrome, gradient gauges, or fake charts.
- Fulfillment CTA (`#06C755`) is an explicit product exception for LINE conversion.

---

## 12. Tables

Use when comparison is genuinely tabular.

- Restrained borders (`1px` header bottom, row dividers optional).
- Header: 11–12px semibold muted or primary.
- Numeric columns: right-aligned, tabular figures where possible.
- Mobile: horizontal scroll **only** for wide data tables — not for pricing cards.
- Avoid heavy zebra striping; use row spacing or light divider.

---

## 13. Data Visualization

- Maximum 3 categorical colors (+ neutral baseline).
- Prefer direct labels over legends when space allows.
- Chart exists to support an insight stated in prose nearby.
- No gradient fills, 3D effects, or decorative grid noise.
- Report inline SVG (path/journey) is acceptable if monochrome + one accent.

---

## 14. Content Hierarchy (section template)

```
Eyebrow (optional)
Heading
Lead (optional, max ~640px)
Content
Evidence / Comparison (optional)
CTA (optional, one primary)
```

Not every section needs all elements.

---

## 15. Responsive Checklist

| Component | Desktop | Mobile |
| --- | --- | --- |
| Pricing cards | 3 columns | 1 column, max-width ~520px centered |
| Report metrics | Multi-column grid | Stack; preserve score prominence |
| Tables | Full width in container | Scroll container with hint OR card rewrite |
| Navigation | Inline links | Toggle menu (hub pattern) |
| CTA blocks | Centered, max ~560px copy | Full-width button acceptable |

---

## 16. Motion

**Allowed:** subtle hover (background/border, ≤150ms) · small opacity/translate on hero reveal (hub-animations.css) · reduced-motion media query respect.

**Avoid:** parallax · scroll-jacking · looping decorative animation · bounce/elastic easing on buttons · large translateY on card hover.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 17. Accessibility (minimum)

- WCAG AA contrast for body text and buttons.
- Logical heading order (one H1 per page).
- Visible focus states (outline or border change).
- Tap targets ≥ 44×44px.
- Link vs button semantics correct (`<a>` for navigation, `<button>` for actions).
- Information not conveyed by color alone (pair with text/icon).
- Japanese price formatting readable at mobile sizes.

---

## 18. Visual Anti-patterns (prohibited)

- Random gradients and colored shadows
- Excessive pill badges on every element
- Card-wrapping every section
- Emoji as UI decoration
- Arbitrary hex colors outside token set
- Mixed border-radius (6 / 10 / 12 / 16 / 20) in one component group
- Multiple full-width primary CTAs in one viewport
- Startup pricing template aesthetics
- Fake urgency / scarcity
- Certification badges, "Certified", 認証審査 visuals
- ABIS references in public UI

---

## 19. CSS Token Strategy & Adoption Plan

**Canonical file:** `assets/design-system.css` (tokens + optional utility classes)

**Do not migrate all pages at once.**

### Phase A — Documentation (complete)

- `design.md` (this file)
- `assets/design-system.css` (tokens)
- `.cursor/rules/ari-design-system.mdc`

### Phase B — Next UI touchpoints (recommended order)

1. `/improve.html` — replace inline `:root` with linked design-system.css; align accent tokens
2. `/report/` — extract repeated inline colors to CSS variables matching tokens
3. New/edited Insights articles — import design-system.css in template
4. `/whitepaper/` — remove hover shadow; align button tokens
5. Homepage / Research — replace duplicated `:root` blocks with import

### Phase C — Optional consolidation

- Shared `assets/hub.css` for nav/footer/components (lower priority; high churn risk)

**Link pattern (incremental):**

```html
<link rel="stylesheet" href="/assets/design-system.css">
<!-- existing page-specific styles below -->
```

---

## 20. Page-Specific Notes

| Page | Container | Accent behavior | Priority |
| --- | --- | --- | --- |
| `/` | 1120px | Blue accent hero | Token import on next edit |
| `/framework/` | 1120px | Legacy teal → migrate to accent | Low |
| `/research/` | 1120px | Monochrome + black CTA | Keep |
| `/insights/` | 1120 shell / 720 article | Monochrome | Template update |
| `/whitepaper/` | 1120px | LINE green on some CTAs — product exception | Shadow removal |
| `/improve.html` | 720 / 1080 / pricing 1120 | Green success accent — align to tokens | **High** |
| `/report/` | SPA inline | Metric green + LINE CTA | Medium |
| `/methodology.html` | 1120px | `--green` legacy variable | Low |

---

## 21. Cursor / Agent Workflow

Before any public UI change:

1. Read `design.md`
2. Prefer tokens from `assets/design-system.css`
3. Reuse existing hub patterns (nav, section-label, btn, card)
4. Do not invent one-off colors/spacing without documenting deviation
5. Check responsive + accessibility checklist (§15–17)
6. Report deviations in PR / task summary

See `.cursor/rules/ari-design-system.mdc` for enforced agent instructions.

---

## 22. Related Business Constraints (non-design but affect UI)

- Do not change Advisory pricing, contract terms, or CTA URL in design tasks.
- Do not expose ABIS slugs or certification language.
- Do not add outcome guarantees or unsupported ROI claims.
- Stripe products/prices unchanged unless explicit product task.
- Protected ABIS Insights articles must not be visually "special-cased" in public hub navigation.

---

## Appendix A — `/improve.html` Assessment (post design.md)

Scored against this specification. **No redesign executed.**

| Section | Verdict | Notes |
| --- | --- | --- |
| Hero | **REFINE** | Structure good; align padding/type to hub hero; reduce competing CTA weight vs pricing |
| Product Ladder | **REFINE** | Flow labels good; align step card tokens to hub card pattern |
| Audience | **REFINE** | Valid content; consider hub list styling or fold into pricing qualification |
| Pricing cards | **KEEP** (structure) / **REFINE** (tokens) | 3-column UX is canonical; migrate colors/spacing/radius to design-system.css |
| Shared CTA | **KEEP** | Correct hierarchy; minor spacing/token alignment |
| Footer | **REFINE** | Replace dark minimal footer with hub `research-footer` pattern for consistency |

### Design quality score

| Criterion | Current | Target (after token alignment) |
| --- | ---: | ---: |
| Visual Hierarchy | 15 / 20 | 18 / 20 |
| Typography | 10 / 15 | 14 / 15 |
| Spacing | 10 / 15 | 14 / 15 |
| Pricing Comparison | 12 / 15 | 14 / 15 |
| Enterprise Trust | 11 / 15 | 14 / 15 |
| Responsive | 8 / 10 | 9 / 10 |
| Brand Consistency | 5 / 10 | 9 / 10 |
| **Total** | **71 / 100** | **92 / 100** |

Target assumes token import + nav/footer alignment — not content rewrite.

---

## Appendix B — Changelog

| Date | Change |
| --- | --- |
| 2026-08-09 | Initial design system foundation from public site audit |
