import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// ─── 開発用: 親ディレクトリの静的ページ（improve.html 等）を提供 ─────────
function devStaticPagesPlugin() {
  const routes = {
    "/improve.html": path.join(rootDir, "improve.html"),
    "/assets/localgeo-dark.css": path.join(rootDir, "assets/localgeo-dark.css"),
  };
  const types = { ".html": "text/html", ".css": "text/css" };

  return {
    name: "dev-static-pages",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const filePath = routes[req.url?.split("?")[0] ?? ""];
        if (!filePath || !fs.existsSync(filePath)) return next();
        const ext = path.extname(filePath);
        res.setHeader("Content-Type", types[ext] || "text/plain");
        res.end(fs.readFileSync(filePath));
      });
    },
  };
}

// ─── 開発用 /api ミドルウェア ──────────────────────────────────────────────
// 本番(Vercel)では api/analyze.js が Serverless Function として動く。
// ローカル `vite dev` では Vercel ランタイムが無いため、同じハンドラを
// Vite の dev サーバーに接続して /api/analyze を提供する。
function devApiPlugin() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/api/analyze") {
          import("../api/analyze.js")
            .then((mod) => mod.default(req, res))
            .catch((e) => {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: e.message }));
            });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env / .env.local からサーバー専用キーを読み込み、dev の /api ハンドラへ渡す。
  // VITE_ プレフィックスではないため、クライアントバンドルには露出しない。
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of [
    "OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "PERPLEXITY_API_KEY",
    "AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_TABLE_NAME",
  ]) {
    if (env[k]) process.env[k] = env[k];
  }

  return {
    base: "/report/",
    plugins: [react(), devApiPlugin(), devStaticPagesPlugin()],
    server: { port: 5188 },
    preview: { port: 5188 },
  };
});
