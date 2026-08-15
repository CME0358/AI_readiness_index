import React, { useEffect, useRef } from "react";
import {
  trackPreviewVideoComplete,
  trackPreviewVideoImpression,
  trackPreviewVideoPlay,
} from "./analytics.js";

export default function PreviewIndustryVideo({
  video,
  videoSegment,
  industry,
  previewTokenHash,
}) {
  const containerRef = useRef(null);
  const impressionSentRef = useRef(false);
  const completeSentRef = useRef(false);

  const analyticsBase = {
    video_segment: videoSegment,
    industry: industry || "",
    preview_token_hash: previewTokenHash,
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node || impressionSentRef.current) return undefined;

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
  }, [videoSegment, industry, previewTokenHash]);

  const handlePlay = () => {
    trackPreviewVideoPlay(analyticsBase);
  };

  const handleEnded = () => {
    if (completeSentRef.current) return;
    completeSentRef.current = true;
    trackPreviewVideoComplete(analyticsBase);
  };

  if (!video?.src) return null;

  return (
    <div
      ref={containerRef}
      className="preview-industry-video"
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "24px 20px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px", color: "#111827" }}>
        AI検索の変化（短尺）
      </h2>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px", lineHeight: 1.6 }}>
        御社の業種に近い事例で、AI比較・予約時代の流れをご覧いただけます。
      </p>
      <div
        className="preview-industry-video__frame"
        style={{
          aspectRatio: "9 / 16",
          maxWidth: 280,
          width: "100%",
          margin: "0 auto",
          background: "#0A0A0A",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <video
          className="preview-industry-video__player"
          src={video.src}
          poster={video.poster || undefined}
          controls
          playsInline
          preload="metadata"
          onPlay={handlePlay}
          onEnded={handleEnded}
          aria-label={video.title}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
      <p
        style={{
          textAlign: "center",
          fontSize: 12,
          color: "#9CA3AF",
          margin: "12px 0 0",
        }}
      >
        {video.title}
      </p>
    </div>
  );
}
