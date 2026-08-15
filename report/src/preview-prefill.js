/**
 * Preview funnel → FormPage prefill sanitization.
 * Email is never prefilled. Industry must match FormPage options.
 */

export const FORM_INDUSTRY_OPTIONS = [
  "小売・EC",
  "飲食・フード",
  "美容・ヘルスケア",
  "不動産",
  "教育・スクール",
  "医療・歯科",
  "宿泊・ホテル",
  "フィットネス",
  "その他",
];

const MAX_COMPANY_LEN = 200;
const MAX_URL_LEN = 500;

export function sanitizeUrl(raw) {
  const value = String(raw || "").trim().slice(0, MAX_URL_LEN);
  if (!value) return "";
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href.replace(/\/+$/, "") || parsed.href;
  } catch {
    return "";
  }
}

export function sanitizePreviewPrefill(raw = {}) {
  const company = String(raw.company || raw.company_name || "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, MAX_COMPANY_LEN);

  const url = sanitizeUrl(raw.url || raw.website_url || "");

  const industryRaw = String(raw.industry || "").trim();
  const industry = FORM_INDUSTRY_OPTIONS.includes(industryRaw) ? industryRaw : "";

  return {
    company,
    url,
    industry,
    email: "",
    preview_token: typeof raw.preview_token === "string" ? raw.preview_token.slice(0, 64) : "",
    candidate_id: typeof raw.candidate_id === "string" ? raw.candidate_id.slice(0, 32) : "",
  };
}

export function readPreviewPrefillFromSession(sessionStorageLike) {
  if (!sessionStorageLike) return null;
  try {
    const raw = sessionStorageLike.getItem("ari_preview_prefill");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    sessionStorageLike.removeItem("ari_preview_prefill");
    const sanitized = sanitizePreviewPrefill(parsed);
    if (!sanitized.company && !sanitized.url) return null;
    return sanitized;
  } catch {
    try { sessionStorageLike.removeItem("ari_preview_prefill"); } catch { /* noop */ }
    return null;
  }
}
