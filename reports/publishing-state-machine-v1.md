# Publishing Operational State Machine v1

> Compatible with existing `schedule.json` / `buffer/queue.json` — no status migration.

## Schedule-side states

| Operational state | Storage | Entry condition |
| --- | --- | --- |
| `editorial_hold` | `status: editorial_hold` | Default for unreleased v2 articles |
| `scheduled` | `status: scheduled` + `publishAt` future | After unlock |
| `publish_due` | *(derived)* | `scheduled` + `publishAt <= now` |
| `published` | `status: published` | Git publish complete |
| `verification_pending` | `published` without `productionVerifiedAt` | Awaiting production URL check |
| `published_verified` | `published` + `productionVerifiedAt` set | HTTP 200 + article HTML validated |
| `publish_failed` | `reports/publishing-pipeline-failures.json` | Publish gate / git / quality failure |

## Buffer-side states (queue.json)

| Operational state | Storage | Entry condition |
| --- | --- | --- |
| `published_verified` | schedule verified; buffer channels pending | Eligible for Buffer reconciliation |
| `buffer_queued` | channel `bufferUpdateId` set | Buffer API success |
| `buffer_partial` | `status: partially_queued` | Some channels queued, others pending/failed |
| `buffer_failed` | channel `status: failed` | Buffer API / content failure |
| `complete` | all channels queued | Pipeline done for the day |

## Transitions (reconciliation worker)

```
editorial_hold ──unlock──► scheduled ──publishAt due──► publish_due
publish_due ──publish──► published ──verify 200──► published_verified
published_verified ──buffer per channel──► buffer_queued / buffer_partial
buffer_partial ──retry failed channels──► buffer_queued ──► complete
```

## New optional fields (schedule.json)

- `productionVerifiedAt` — ISO timestamp when production URL verified
- `verificationAttemptCount` — bounded retry counter

## Failure persistence

`reports/publishing-pipeline-failures.json`:

```json
{
  "failures": {
    "slug": {
      "slug", "stage", "attemptedAt", "failureReason",
      "retryable", "attemptCount", "lastSuccessStage"
    }
  }
}
```

No secrets stored.
