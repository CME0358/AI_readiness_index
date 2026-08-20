import React, { useEffect, useRef, useState } from "react";
import {
  hashPreviewToken,
  trackPreviewEngaged,
  trackPreviewVisit,
} from "./analytics.js";
import PreviewIndustryVideo from "./PreviewIndustryVideo.jsx";
import { sanitizePreviewPrefill } from "./preview-prefill.js";
import { CheckBadge } from "./preview-shared.jsx";
import { resolvePreviewVideo, normalizePreviewVideoSegment } from "./video-carousel-data.js";
import { parsePreviewToken } from "./partner-preview-routing.js";

export default function PreviewPage({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewTokenHash, setPreviewTokenHash] = useState("none");
  const engagedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokenHash = await hashPreviewToken(token);
        if (!cancelled) setPreviewTokenHash(tokenHash);

        const res = await fetch(`/api/preview/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `http_${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          trackPreviewVisit({
            preview_token_hash: tokenHash,
            campaign_id: json.campaign_id,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleEngage = () => {
    if (!data) return;
    if (!engagedRef.current) {
      engagedRef.current = true;
      trackPreviewEngaged({
        preview_token_hash: previewTokenHash,
        campaign_id: data.campaign_id,
        video_segment: data.video_segment || "membership",
      });
    }
    try {
      sessionStorage.setItem("ari_preview_prefill", JSON.stringify(sanitizePreviewPrefill({
        company: data.company_name || "",
        url: data.url || "",
        industry: data.industry || "",
        candidate_id: data.candidate_id || "",
        preview_token: token,
      })));
    } catch { /* noop */ }
    window.location.href = "/report/";
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F8F8" }}>
        <p style={{ color: "#6B7280", fontSize: 14 }}>確認項目を読み込んでいます…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F8F8", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 40, maxWidth: 480, textAlign: "center", boxShadow: "0 4px 32px rgba(0,0,0,0.08)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>プレビューを表示できません</h1>
          <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>
            リンクの有効期限が切れているか、対象サイトの確認ができませんでした。
          </p>
          <a href="/report/" style={{ display: "inline-block", marginTop: 24, color: "#0A0A0A", fontWeight: 700 }}>レポートページへ</a>
        </div>
      </div>
    );
  }

  const summary = data.check_summary || {};
  const observations = data.observations || [];
  const checkItems = summary.check_items || [];
  const videoSegment = normalizePreviewVideoSegment(data.video_segment);
  const previewVideo = resolvePreviewVideo(videoSegment);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F8F8", padding: "48px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9B9B9B", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          Personalized Preview
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0A0A0A", letterSpacing: "-0.8px", margin: "0 0 8px" }}>
          {data.company_name}
        </h1>
        <p style={{ fontSize: 13, color: "#9B9B9B", marginBottom: 32, wordBreak: "break-all" }}>{data.url}</p>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", boxShadow: "0 4px 32px rgba(0,0,0,0.06)", marginBottom: 20 }}>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, marginTop: 0 }}>
            公開ページのHTML解析時点で確認できた項目の概要です。点数・AI認識率・順位は本ページでは開示しません。
          </p>
          {observations.length > 0 && (
            <ul style={{ margin: "20px 0 0", paddingLeft: 20, color: "#111827", lineHeight: 1.8 }}>
              {observations.map((obs) => (
                <li key={obs.code} style={{ marginBottom: 10 }}>
                  <strong style={{ display: "block", fontSize: 14 }}>{obs.copy}</strong>
                  {obs.qualification && (
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{obs.qualification}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <PreviewIndustryVideo
          video={previewVideo}
          videoSegment={videoSegment}
          industry={data.industry || ""}
          previewTokenHash={previewTokenHash}
        />

        <div style={{ background: "#fff", borderRadius: 16, padding: "28px", boxShadow: "0 4px 32px rgba(0,0,0,0.06)", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>確認項目（抜粋）</h2>
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              {summary.checked_count ?? 0} / {summary.total_teaser ?? 23} 項目
            </span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {checkItems.map((item) => (
              <li key={item.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid #F3F4F6",
              }}>
                <span style={{ fontSize: 14, color: "#111827" }}>{item.label}</span>
                <CheckBadge status={item.status} />
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 16, marginBottom: 0 }}>
            完全版レポート（¥29,800 税別）では23項目すべてを評価し、改善優先順位を提示します。
          </p>
        </div>

        <button
          type="button"
          onClick={handleEngage}
          style={{
            width: "100%", background: "#0A0A0A", color: "#fff", border: "none",
            padding: "16px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}
        >
          完全版レポートを入手する
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "#9B9B9B", marginTop: 12 }}>
          会社名・URL・業種は次の画面で自動入力されます
        </p>
      </div>
    </div>
  );
}

export { parsePreviewToken };
