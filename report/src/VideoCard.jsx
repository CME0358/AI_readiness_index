import React, { useEffect, useRef, useState } from "react";

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
      <path d="M8.25 6.5v7l5.5-3.5-5.5-3.5z" fill="currentColor" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 6h2l2.5-2v8L5.5 10h-2V6z" fill="currentColor" />
      <path d="M11.5 5.5l-5 5M6.5 5.5l5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 6h2l2.5-2v8L5.5 10h-2V6z" fill="currentColor" />
      <path d="M11 6.5a3 3 0 010 3M12.5 5a5 5 0 010 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
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
  const [isMuted, setIsMuted] = useState(true);
  const hasMedia = Boolean(video.src || video.embedUrl);
  const showPosterOnly = !shouldLoad || !hasMedia || (video.embedUrl && !isPlaying);

  useEffect(() => {
    if (!isPlaying) setIsMuted(true);
  }, [isPlaying]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || video.embedUrl) return;
    el.muted = isMuted;
    if (isPlaying) {
      el.play().catch(() => {
        if (!isMuted) {
          el.muted = true;
          setIsMuted(true);
          el.play().catch(() => {});
        }
      });
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isPlaying, isMuted, video.embedUrl, shouldLoad]);

  const toggleSound = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const el = videoRef.current;
    if (!el || !isPlaying) return;
    const nextMuted = !isMuted;
    el.muted = nextMuted;
    setIsMuted(nextMuted);
    el.play().catch(() => {
      if (!nextMuted) {
        el.muted = true;
        setIsMuted(true);
      }
    });
  };

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

        {isPlaying && !video.embedUrl && (
          <button
            type="button"
            className="video-carousel__sound"
            onClick={toggleSound}
            aria-label={isMuted ? "音声をオン" : "音声をオフ"}
            aria-pressed={!isMuted}
          >
            {isMuted ? <MuteIcon /> : <VolumeIcon />}
          </button>
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
