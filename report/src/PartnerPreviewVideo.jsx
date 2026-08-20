import React, { useEffect, useRef, useState } from "react";
import {
  trackPreviewVideoComplete,
  trackPreviewVideoImpression,
  trackPreviewVideoPlay,
} from "./analytics.js";

/**
 * Generic partner preview video slot.
 * Renders placeholder when asset is missing — page must not crash.
 */
export default function PartnerPreviewVideo({ video }) {
  const containerRef = useRef(null);
  const [assetAvailable, setAssetAvailable] = useState(null);
  const impressionSentRef = useRef(false);
  const completeSentRef = useRef(false);

  const analyticsBase = {
    video_segment: "partner_generic",
    industry: "agency_partner",
    preview_token_hash: "partner_preview",
  };

  useEffect(() => {
    if (!video?.src) {
      setAssetAvailable(false);
      return undefined;
    }
    let cancelled = false;
    fetch(video.src, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setAssetAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setAssetAvailable(false);
      });
    return () => { cancelled = true; };
  }, [video?.src]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || impressionSentRef.current || assetAvailable !== true) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) return;
        if (impressionSentRef.current) return;
        impressionSentRef.current = true;
        trackPreviewVideoImpression(analyticsBase);
        observer.disconnect();
      },
      { threshold: [0.5] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [assetAvailable]);

  const handlePlay = () => {
    trackPreviewVideoPlay(analyticsBase);
  };

  const handleEnded = () => {
    if (completeSentRef.current) return;
    completeSentRef.current = true;
    trackPreviewVideoComplete(analyticsBase);
  };

  return (
    <section ref={containerRef} className="partner-preview-video" aria-labelledby="partner-video-heading">
      <h2 id="partner-video-heading" className="partner-preview-video__title">
        AI検索の変化（短尺）
      </h2>
      <p className="partner-preview-video__lead">
        {video?.description ||
          "ユーザーがAIに「おすすめのサービスを教えて」と質問したとき、検索では見つかる企業が候補に入らないケースを示します。"}
      </p>

      <div className="partner-preview-video__frame">
        {assetAvailable === true ? (
          <video
            className="partner-preview-video__player"
            src={video.src}
            poster={video.poster || undefined}
            controls
            playsInline
            muted
            loop
            preload="metadata"
            onPlay={handlePlay}
            onEnded={handleEnded}
            aria-label={video.title}
          />
        ) : (
          <div className="partner-preview-video__placeholder" role="img" aria-label="動画プレースホルダー">
            <div className="partner-preview-video__placeholder-icon" aria-hidden="true">
              ▶
            </div>
            <p className="partner-preview-video__placeholder-title">動画を準備中</p>
            <p className="partner-preview-video__placeholder-copy">
              汎用サンプル動画（<code>{video?.src || "/report/videos/ari-partner-preview.mp4"}</code>）を配置するとここに表示されます。
            </p>
            <ol className="partner-preview-video__placeholder-steps">
              <li>ユーザー「このエリアでおすすめのサービスを教えて」</li>
              <li>AIが複数企業を比較・推薦</li>
              <li>検索では見つかる企業が候補に入らない可能性</li>
              <li>Visibility · Authority · Actionability で確認</li>
            </ol>
          </div>
        )}
      </div>
      {video?.title && (
        <p className="partner-preview-video__caption">{video.title}</p>
      )}
    </section>
  );
}
