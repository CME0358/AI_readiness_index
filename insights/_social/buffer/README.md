# Multi-channel Buffer queue

Git-tracked queue for LinkedIn / Facebook / X daily Buffer transfers.

| File | Role |
| --- | --- |
| `queue.json` | Per-article, per-channel schedule and `bufferUpdateId` |
| `published-log.json` | Successful transfers |
| `failed-log.json` | Failures |

## Dispatcher

```bash
npm run queue:buffer:dry
npm run queue:buffer -- --channels facebook,x --force-slug ai-search-shift
```

Initialize from LinkedIn queue:

```bash
npm run init:buffer-queue
```

## Policy

- 1 article / business day
- Up to 3 Buffer posts per article (1 per channel)
- Per-channel idempotency via `channels.{name}.bufferUpdateId`
