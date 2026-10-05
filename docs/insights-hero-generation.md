# Insights ヒーロー画像の生成手順

新規の Insights ヒーロー（`assets/insights/<slug>/hero.webp`）は、次の手順だけで作る。

1. `createBriefPrompt` が Visual Canon（`ARI_INSIGHTS_VISUAL_CANON.md`）と記事 HTML からブリーフを組む。MODE は TYPOGRAPHIC ONLY。
2. `runNativeGeneration` が Codex Native を実行する。
   `codex exec --ephemeral --skip-git-repo-check --sandbox workspace-write`
   （実装は `--cd` と `--output-last-message` も付ける。`OPENAI_API_KEY` は渡さない。）
3. `readQualityGate` が一時 PNG の **1672×941**（`CANONICAL_HERO_SIZE`）と、生成側が書いた `quality.json` を見る。
4. `optimizeToWebp` が Mac 上の変換スクリプトを呼ぶ。

```text
/usr/local/bin/node /Users/takeshisasaki/ari-webp-tool-l5sDwJ/convert-webp.mjs <png> <hero.webp>
```

統合は既存の `integrateCanonicalHero` / `integrateScheduledCanonicalHero` / `integrateHoldStockHero` と `markHeroReady`。キャンバスサイズ、Visual Canon 本文、ブリーフ契約は変えない。

Pillow、Cursor の GenerateImage、ffmpeg `drawtext`、単体の `cwebp` は Insights ヒーローの代替にしない。ツールが足りないホストでは画像を作らず、`packageReadiness` を `HERO_PENDING` のままにする。

## ローカル（Mac）での実行

前提:

```bash
command -v codex
test -x /usr/local/bin/node
test -f /Users/takeshisasaki/ari-webp-tool-l5sDwJ/convert-webp.mjs
```

公開前（予約記事、最大 2 本）:

```bash
./scripts/run-prepublish-hero.sh
# または
npm run visual:prepublish
```

公開済みでヒーローが無い記事の回復:

```bash
./scripts/local-visual-worker.sh
# または
npm run visual:worker
```

`codex` のログイン状態は `CODEX_HOME`（既定は `$HOME/.codex`）を使う。launchd からの常駐は `scripts/install-local-visual-worker.sh`。

どちらも、ツールが無い状態で候補の生成に入ると `INSIGHTS_HERO_TOOLCHAIN_MISSING` で終了する。画像ファイルは作らない。

## クラウド VM / CI

`codex` または `convert-webp.mjs` が無い環境ではヒーローを生成しない。

- 記事のスケジュール直後の `triggerImmediatePrepublishHero` はワーカーを起動せず、`reports/prepublish-hero-request.json` に `DEFERRED_TO_LOCAL_RUNTIME` を残す。
- 予約記事で `hero.webp` が無い状態は `HERO_PENDING` として扱う。
- `node scripts/run-prepublish-hero.mjs` や `node scripts/run-insights-visual-worker.mjs` が生成段階まで進んだ場合は、非ゼロ終了と `VISUAL_WORKER_TOOLCHAIN_MISSING` になる。

既存の `assets/insights/*/hero.webp` は、この手順の復旧だけでは置き換えない。2026-10-01 以降に Pillow または GenerateImage で作った分を Codex Native で描き直す作業は、上記の Mac 前提が揃ったマシンで別途行う。
