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
  };

  return {
    name: "dev-static-pages",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url?.split("?")[0] ?? "";
        const filePath = routes[urlPath];
        if (filePath && fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const types = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
          res.setHeader("Content-Type", types[ext] || "application/octet-stream");
          res.end(fs.readFileSync(filePath));
          return;
        }
        if (urlPath.startsWith("/assets/")) {
          const assetPath = path.join(rootDir, urlPath);
          if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
            const ext = path.extname(assetPath);
            const types = { ".css": "text/css", ".js": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
            res.setHeader("Content-Type", types[ext] || "application/octet-stream");
            res.end(fs.readFileSync(assetPath));
            return;
          }
        }
        next();
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
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/api/analyze") {
          import("../api/analyze.js")
            .then((mod) => mod.default(req, res))
            .catch((e) => {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: e.message }));
            });
          return;
        }
        if (url === "/api/verify-purchase") {
          import("../api/verify-purchase.js")
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
    "STRIPE_SECRET_KEY", "COMPANY_REPORT_BUNDLE_PAYMENT_URL",
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
