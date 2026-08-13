# Publishing Pipeline Forensic Audit

> **Date:** 2026-08-13  
> **Repo:** `CME0358/AI_readiness_index`  
> **Scope:** Season 1 autonomous publish → verify → Buffer pipeline  
> **Method:** Repository file inspection + `gh run list` / `gh run view --log-failed` (evidence only)

---

## Executive Summary

The pipeline **can publish and queue Buffer posts** when all steps succeed in sequence on the same GHA run. Failures cluster around **(RC-1) GHA cron latency**, **(RC-2) git push with unstaged changes**, **(RC-3) treating GHA green as production success**, **(RC-4) fixed-clock Buffer eligibility**, and **(RC-5) no reconciliation worker**. Manual `workflow_dispatch` recoveries (evidence: 2026-08-10 through 2026-08-12) indicate the system is **not autonomously self-healing**.

---

## Workflows Inspected

| Workflow | Cron (UTC) | Nominal JST | Role |
| --- | --- | --- | --- |
| `unlock-next-insight.yml` | `0 6 * * 1-5` | 15:00 weekdays | Day-before unlock → `scheduled` |
| `publish-scheduled-insights.yml` | `0 1`, `0 4`, `30 5 * * 1-5` | 10:00 / 13:00 / 14:30 | Publish + inline Buffer |
| `queue-daily-buffer-posts.yml` | `0 4 * * 1-5` | 13:00 | Buffer fallback |
| Vercel cron (`vercel.json`) | `0 1 * * 1-5` | 10:00 | Dispatches publish workflow (best-effort) |

All three GHA workflows: `permissions: contents: write`, push via `scripts/lib/gha-git-push.sh`.

---

## 15-Point Audit (Evidence)

### 1. 10:00 JST cron — actual start time

**Evidence:** `gh run list --limit 30` (2026-08-10 – 2026-08-12):

| Workflow | Nominal | Actual UTC | Actual JST |
| --- | --- | --- | --- |
| Publish (schedule) | 01:00 UTC | 03:25, 05:27, 05:37, 06:28, 06:51 UTC | **12:25 – 15:51 JST** |
| Unlock (schedule) | 06:00 UTC | 07:11, 07:28, 07:45 UTC | **16:11 – 16:45 JST** |
| Queue Buffer (schedule) | 04:00 UTC | 05:04, 05:23, 05:28 UTC | **14:04 – 14:28 JST** |

**Classification:** RC-1 — GHA scheduled workflows routinely start **1–3+ hours late** vs nominal JST wall clock.

---

### 2. schedule.json datetime comparison

**Evidence:** `scripts/lib/editorial-status.mjs` → `extractDueArticles()`:

```javascript
return new Date(a.publishAt).getTime() <= now.getTime();
```

Uses ISO8601 with explicit `+09:00` offsets in `schedule.json` (`"timezone": "Asia/Tokyo"`).

**Classification:** OK — comparison is instant-based, not date-string lexical.

---

### 3. JST / UTC conversion

**Evidence:**

- `schedule.json` stores `publishAt` as JST ISO (`2026-08-13T10:00:00+09:00`).
- `scripts/lib/business-days.mjs` uses `timeZone: 'Asia/Tokyo'` for weekday checks.
- `scripts/lib/social-schedule.mjs` → `jstMinutesFromMidnight()` documented as TZ-independent.
- GHA runners use UTC; scripts pass `new Date()` or explicit `--now` ISO.

**Classification:** OK in code; **RC-1** at infrastructure layer (cron delay, not conversion bug).

---

### 4. `publishAt <= now` gate

**Evidence:** `extractDueArticles()` + `isPublishEligible()` require `status === 'scheduled'` and `publishAt` set.

**Classification:** OK — gate exists; articles stay `scheduled` until `now` passes.

---

### 5. scheduled → published transition

**Evidence:** `scripts/publish-scheduled-insights.mjs` lines 211–214:

```javascript
entry.status = 'published';
entry.publishedAt = now.toISOString();
```

**Classification:** OK for git-side state; **no `published_verified` field** exists (RC-3).

---

### 6. `_scheduled/{slug}` → `insights/{slug}` move

**Evidence:** `fs.renameSync(src, dest)` in `publish-scheduled-insights.mjs`; fails if dest exists (`process.exit(1)`).

**Classification:** OK with idempotency guard; **blocks re-run** if partial failure left dest behind (RC-5).

---

### 7. Git commit creation

**Evidence:** Workflows grep `UPDATED=1` from script stdout, then call `gha-git-push.sh`.

**Classification:** OK when publish produces changes; **skipped when `UPDATED=0`** (no due article / already done).

---

### 8. Git push success

**Evidence:** Failed run `31085855077` (Unlock, 2026-08-06):

```
error: cannot pull with rebase: You have unstaged changes.
git push failed after 5 attempts
```

Commit succeeded locally on runner; push failed. Unlock had committed only partial paths; unstaged `_scheduled/{slug}/` HTML remained.

**Fix present in repo:** `gha-git-push.sh` now uses `git pull --rebase --autostash`; unlock workflow includes `insights/_scheduled/` in commit paths.

**Classification:** RC-2 (historical); mitigated in current `gha-git-push.sh` (lines 28–29).

---

### 9. GitHub Actions push permissions

**Evidence:** All three workflows: `permissions: contents: write`.

**Classification:** OK.

---

### 10. Vercel deployment completion check

**Evidence:**

- `publish-scheduled-insights.yml` — no Vercel API poll; relies on git push → Vercel auto-deploy.
- `queue-daily-buffer-posts.mjs` — optional `--wait-deploy` → `waitForArticleProduction()` (90s deadline, 10s poll) in `scripts/lib/wait-production-url.mjs`.
- Standalone `queue-daily-buffer-posts.yml` cron uses `--wait-deploy` only when token present.

**Classification:** RC-3 — publish workflow does **not** wait for Vercel; Buffer step may run before production is live.

---

### 11. Production URL HTTP 200 check

**Evidence:**

- `scripts/lib/url-verify.mjs` — GET + h1/canonical/article-cta validation.
- Used by Buffer dispatcher (`processArticleChannels`) and `--wait-deploy`.
- **Not invoked** after publish step in `publish-scheduled-insights.yml` before marking success.

**Classification:** RC-3 — verification exists but **not wired as publish success criterion**.

---

### 12. Buffer workflow publish success condition

**Evidence:** `pickTodayArticle()` in `buffer-dispatcher.mjs` filters by:

```javascript
toJstDateString(new Date(p.bufferTransferAt)) === todayYmd
```

Plus article status in transferable set. `--wait-deploy` verifies URL when flag set.

Inline publish workflow passes `--wait-deploy --force-slug` only **after** publish in same job — still coupled to **same-run** timing, not persistent verified state.

**Classification:** RC-4 — Buffer eligibility tied to **calendar transfer day**, not production verification persistence.

---

### 13. Implicit time dependencies between workflows

**Evidence:**

| Dependency | Mechanism |
| --- | --- |
| Unlock 15:00 → Publish 10:00 next day | `publishAt` set at unlock |
| Publish → Buffer 10:30 | Same workflow chain OR separate cron at 04:00 UTC |
| Buffer channel times 11:30/11:45/12:00 | `resolvePublishAt()` 30-min bump if late |

If publish GHA runs at 13:00+ JST, `bufferTransferAt` (10:30 same day) is **past**; fallback cron at 13:00 may still miss if URL not live.

**Classification:** RC-4 + RC-1 — **workflow execution wall clock** effectively gates Buffer.

---

### 14. Workflow failure recovery on next run

**Evidence:**

| Failure | Next scheduled recovery? |
| --- | --- |
| Unlock push failed (8/6) | Next unlock day; **manual** dispatch used for competitor-blind-spot (8/7) |
| Publish prepare exit 1 (8/6) | Fixed: `prepare-scheduled-article.mjs` exits 0 when no scheduled article |
| Buffer URL 404 | `article_url_unavailable` status; **no auto retry** without manual dispatch |
| Publish missed entirely | Fallback crons at 04:00/05:30 UTC; still no verify/reconcile loop |

**Classification:** RC-5 — partial retry via extra crons; **no unified reconciliation**.

---

### 15. Idempotency

**Evidence:**

| Layer | Mechanism | Gap |
| --- | --- | --- |
| Publish | Dest exists → exit 1 | No "already published" soft-skip |
| Git | `gha-git-push.sh` skips empty staged diff | OK |
| Buffer | `bufferUpdateId`, duplicate schedule sentinel | OK per channel |
| Buffer | `pickTodayArticle` date filter | May skip verified-unqueued article on wrong calendar day |

**Classification:** Partial — Buffer idempotency OK; **publish + date-based pick** gaps remain.

---

## Root Cause Classification

| ID | Root Cause | Severity |
| ---: | --- | ---: |
| RC-1 | GHA cron starts 1–3h late vs nominal JST | High |
| RC-2 | Git push failed on unstaged `_scheduled/` changes (fixed 2026-08) | Medium (mitigated) |
| RC-3 | GHA success ≠ production URL verified | **Critical** |
| RC-4 | Buffer eligibility uses fixed transfer day / clock | **Critical** |
| RC-5 | No reconciliation worker (10:00–13:00 JST window) | **Critical** |
| RC-6 | Publish failure leaves no durable repo-visible failure state | High |

---

## Current State Snapshot (2026-08-13 ~10:13 JST)

| Item | Value | Source |
| --- | --- | --- |
| Next article | `readiness-baseline` | `schedule.json` (remote `3ae8f1a`) |
| Schedule status | `scheduled` | Unlocked 2026-08-12T07:28:10Z |
| publishAt | `2026-08-13T10:00:00+09:00` | `schedule.json` |
| Last published | `ari-vs-geo-seo` (2026-08-12) | `schedule.json` |
| Buffer queue | `readiness-baseline` channels `scheduled`, no `bufferUpdateId` | `buffer/queue.json` |

**Derived operational state at audit time:** `publish_due` (scheduled + publishAt <= now not yet evaluated by publish run today).

---

## Recommended Remediation (implemented in Reliability v1)

1. **Reconciliation worker** — weekday 10:00–13:00 JST, 15-min cadence: publish → verify → buffer.
2. **`productionVerifiedAt`** on schedule entries — derived `published_verified` without status migration.
3. **Verification-based Buffer pick** — replace date-only `pickTodayArticle` for reconciliation path.
4. **Bounded retry verification** — 30/60/120/180s delays (not fixed sleep only).
5. **Failure persistence** — `reports/publishing-pipeline-failures.json` (no secrets).
6. **Health report** — `reports/pipeline-health-YYYY-MM-DD.md` per reconciliation run.
7. **Deprecate** (not delete) standalone publish/buffer crons as manual fallback.

---

## Update History

- 2026-08-13: Initial forensic audit (Reliability v1 Phase 1)
