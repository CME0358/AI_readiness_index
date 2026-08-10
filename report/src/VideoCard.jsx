import React, { useEffect, useRef } from "react";

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
      <path d="M8.25 6.5v7l5.5-3.5-5.5-3.5z" fill="currentColor" />
    </svg>
  );
}

export default function VideoCard({
  video,
  isHovered,
  isActive,
  shouldLoad,
  isPlaying,
  slideRef,
  onMouseEnter,
  onMouseLeave,
}) {
  const videoRef = useRef(null);
  const hasMedia = Boolean(video.src || video.embedUrl);
  const showPosterOnly = !shouldLoad || !hasMedia || (video.embedUrl && !isPlaying);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || video.embedUrl) return;
    if (isPlaying) {
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isPlaying, video.embedUrl, shouldLoad]);

  const cardClass = [
    "video-carousel__card",
    isHovered ? "video-carousel__card--hovered" : "",
    isActive ? "video-carousel__card--active" : "",
    isPlaying ? "video-carousel__card--playing" : "",
  ].filter(Boolean).join(" ");

  const inner = (
    <>
      <div className="video-carousel__media">
        {showPosterOnly ? (
          <div
            className="video-carousel__poster video-carousel__poster--placeholder"
            data-scene={video.id}
            style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined}
            role="img"
            aria-label={video.title}
          />
        ) : video.embedUrl ? (
          <iframe
            className="video-carousel__embed"
            src={isPlaying ? video.embedUrl : undefined}
            title={video.title}
            loading="lazy"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            className="video-carousel__video"
            src={video.src}
            poster={video.poster || undefined}
            muted
            loop
            playsInline
            preload="none"
            aria-label={video.title}
          />
        )}

        {showPosterOnly && (
          <span className="video-carousel__play" aria-hidden="true">
            <PlayIcon />
          </span>
        )}
      </div>
      <p className="video-carousel__title">{video.title}</p>
    </>
  );

  return (
    <div
      ref={slideRef}
      className="video-carousel__slide"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-video-id={video.id}
    >
      {video.href ? (
        <a
          href={video.href}
          className={cardClass}
          aria-label={`${video.title} — 動画を見る`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (isPlaying) event.preventDefault();
          }}
        >
          {inner}
        </a>
      ) : (
        <div
          className={cardClass}
          role="group"
          aria-label={video.title}
        >
          {inner}
        </div>
      )}
    </div>
  );
}
