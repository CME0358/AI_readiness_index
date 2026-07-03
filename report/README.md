# Agent Readiness Index — 診断レポート

Vite + React のフロントエンドと、`/api/analyze`（Vercel Serverless Function）の
バックエンドで構成された AI 露出診断レポートアプリ。

## 構成

```
report/
├── index.html              Vite エントリ（GA4タグ入り）
├── package.json
├── vite.config.js          dev時に /api を提供するミドルウェア入り
├── vercel.json             Vercel デプロイ設定
├── .env.example            サーバー専用APIキーの雛形
├── src/
│   ├── main.jsx            React マウント
│   └── agent-readiness-report.jsx   UI 本体（キーは持たない）
└── api/
    └── analyze.js          AI呼び出し・サイト解析・スコアリング（サーバー側）
```

## セットアップ

```bash
npm install
```

### ローカル開発

```bash
npm run dev          # http://localhost:5188
```

- `/api/analyze` は Vite の dev ミドルウェアで同一ポートから提供される。
- APIキー未設定なら **DEMO モード**（ダミーレポート）で全フローが動作する。
- LIVE モードにするには `.env.example` を `.env` にコピーしてキーを記入。

### 本番ビルド / プレビュー

```bash
npm run build        # dist/ を生成
npm run preview      # dist をローカル確認（/api は動かない）
```

## APIキー（重要）

- キーは **サーバー専用環境変数**（`OPENAI_API_KEY` 等）で保持する。
- `VITE_` / `NEXT_PUBLIC_` プレフィックスは **絶対に付けない**（クライアント露出するため）。
- Vercel では「Settings > Environment Variables」に登録する。

| 変数名 | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | ChatGPT (gpt-4o-mini) |
| `GEMINI_API_KEY` | Gemini 1.5 Flash |
| `ANTHROPIC_API_KEY` | Claude Haiku |
| `PERPLEXITY_API_KEY` | Perplexity (sonar) |

## デプロイ（Vercel）

1. このディレクトリ（`report/`）を Vercel プロジェクトの Root Directory に指定。
2. Framework は Vite（自動検出）。
3. 環境変数に上記キーを登録。
4. デプロイ。`/api/analyze` は自動で Serverless Function 化される。
