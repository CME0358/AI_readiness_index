# ARI Insights Visual Canon v0.3

Status: Candidate / authoritative for automated ARI Insights image generation

## Purpose

Create a unified editorial thumbnail or hero that lets a reader identify an Insights article at a glance.

The image is a topic identity, not a visual explanation of the article.

Role split:

- Article body: detailed explanation
- Image: topic identity

## Automated generation mode

TYPOGRAPHIC MODE ONLY.

EXPLANATORY, CONCEPTUAL, DATA, ABSTRACT, and other diagrammatic modes are not permitted for automated operation until Native image-generation fidelity and article adherence are re-evaluated.

## Visual style

- Premium B2B editorial
- Japanese business / research publication
- White or very light neutral background
- Navy, blue, and subtle cyan accents
- Strong typography and generous negative space
- Minimal, modern, restrained, and thumbnail-readable
- No photography
- No people, robots, humanoids, brains, AI chips, generic AI icons, dashboards, complex diagrams, decorative 3D objects, abstract sculptures, or logos

## Text selection

Read the full article before generation and extract:

1. Primary Topic
2. Key Phrase
3. Optional short qualifier

Use short image text consisting of the Primary Topic plus a short Japanese phrase. Do not force the full H1 into the image and do not add claims absent from the article.

Preferred text length: 1–8 words or short phrases.

## Required pre-generation brief

```text
ARTICLE:
PRIMARY_TOPIC:
KEY_PHRASE:
IMAGE_TEXT:
LAYOUT: LARGE KEYWORD | SPLIT TITLE | KEYWORD + QUESTION | EDITORIAL STATEMENT
RATIONALE:
```

## Typography layouts

- LARGE KEYWORD: large Primary Topic with a smaller Japanese qualifier
- SPLIT TITLE: a strong title split across two or three lines
- KEYWORD + QUESTION: Primary Topic plus “とは？” or “どう変わる？”
- EDITORIAL STATEMENT: a short article-core statement as the dominant text

Keep palette, spacing, font character, hierarchy, and restraint consistent while varying the typography layout.

## Generation and output

- Use Native image generation by default.
- Do not require or use `OPENAI_API_KEY` for Native generation.
- Generate one high-resolution 16:9 landscape hero.
- Derive Social from the same hero using a deterministic safe crop / resize to 1200×630 when needed.
- Do not generate Hero and Social independently; never rerun image generation for Social.
- Keep important text within the central safe area.

## Quality gate

After generation, verify:

- Text is readable and Japanese text is correct
- No garbled characters or accidental extra text
- No accidental logo or unwanted symbol
- No unrelated object
- No generic AI imagery
- Sufficient contrast and thumbnail readability
- Clear article relevance

Any garbled, incorrect, or unintended text is FAIL.

## Asset lifecycle and storage

```text
GENERATE → VALIDATE → OPTIMIZE → DEPLOY → PRODUCTION VERIFY → CLEANUP
```

The single permanent Source of Truth for each article is:

- `assets/insights/<slug>/hero.webp`

No `social.webp` is a permanent production asset. The same canonical `hero.webp` is used for LinkedIn, Facebook, and X. A 1200×630 derivative is created only at handoff time, then verified and cleaned up.

The generation lifecycle is:

```text
Native Generation → temporary high-resolution PNG → Visual Quality Gate
→ WebP conversion / optimization → hero.webp → production deploy
→ production verification → temporary PNG cleanup
```

Temporary assets include `visual-test.png`, `visual-v02-test.png`, `visual-v03-test.png`, `generation-*.png`, `tmp-*.png`, `original-*.png`, `social.png`, `social.webp`, 1200×630 derivatives, intermediate crops, alternate generations, unused variants, and other non-referenced files. They are retained until the relevant verification succeeds.

Production source of truth is only `assets/insights/<slug>/hero.webp`.

Do not retain the original high-resolution PNG or Social derivative as permanent production assets. Convert and compress the Hero to WebP. Social must be generated deterministically from Hero with fixed crop, resize, and quality settings. A build-time or handoff-time derivative is permitted, but it must not be committed or permanently stored.

Article Hero and OG metadata should reference the canonical `hero.webp` directly whenever possible. Do not design metadata around a permanently stored 1200×630 file.

Generation directories and `.gitignore` rules should prevent source PNGs and temporary derivatives from being Git-tracked. Existing production assets must not be mechanically deleted; audit references before migration.

Do not delete temporary or original files until all of the following pass:

- Git push success
- Production deployment success
- Production article HTTP 200
- Hero HTTP 200
- Social HTTP 200
- HTML image reference verified
- `og:image` verified
- Production image load and visual verification

Never delete `hero.webp` as part of cleanup. Social derivatives may be deleted only after the receiving Buffer or SNS handoff has been accepted and delivery verification is available. On failure or `UNKNOWN`, retain the derivative for recovery.

Cleanup status values: `PENDING`, `VERIFIED`, `CLEANED`, `FAILED`.

If verification fails, retain recovery assets and mark cleanup `FAILED`. Do not delete currently referenced production assets, recovery assets, unverified assets, manually approved canonical assets, or Visual Canon files.

## Cleanup report

Every cleanup operation must report:

```text
GENERATED:
OPTIMIZED:
DEPLOYED:
PRODUCTION VERIFIED:
DELETED:
RETAINED:
FINAL STORAGE:
GIT STATUS:
```

## Storage invariant

After normal completion, the only permanent image for each article is:

```text
assets/insights/<slug>/hero.webp   KEEP
social.webp                        DELETE / DO NOT COMMIT
source.png                         DELETE / DO NOT COMMIT
visual-test                        DELETE / DO NOT COMMIT
derivatives                        DELETE / DO NOT COMMIT
```

Existing Social or test assets are not deleted by a Canon update. Migration requires, in order: reference audit, Hero WebP migration, HTML/OG/Buffer reference verification, production verification, and obsolete-asset cleanup.

## Current update boundary

This v0.3 update defines policy only. It does not generate images, delete existing images, modify HTML, update metadata, change Buffer or queues, commit, push, deploy, or perform production verification.
