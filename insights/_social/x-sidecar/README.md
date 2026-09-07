# ARI X Traffic Sidecar v1.0

This namespace is independent from `insights/_social/buffer/` and
`insights/_social/x/`.

- `ledger.json` is the canonical Sidecar ownership ledger.
- `redirects.json` is the first-party `/go/{short_id}` mapping authority.
- `ownership` must be `ari_x_traffic_sidecar_v1`.
- Existing Buffer posts are read-only and must never be added to this ledger.
- `ARI_X_TRAFFIC_ENABLED=false` and `ARI_X_TRAFFIC_DRY_RUN=true` are the safe defaults.

The Sidecar uses Buffer read-only queries for scheduled posts, organization
scheduled-post limits, daily channel limits, and rate-limit headers before any
future create operation. Unknown capacity is fail-closed as `HOLD`.
