import React, { useCallback, useEffect, useRef, useState } from "react";
import { REPORT_SCENE_VIDEOS } from "./video-carousel-data.js";
import VideoCard from "./VideoCard.jsx";

const MOBILE_MQ = "(max-width: 767px)";
const REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

function nearestIndex(track, slides) {
  const center = track.scrollLeft + track.clientWidth / 2;
  let bestIdx = 0;
  let bestDist = Infinity;
  slides.forEach((el, idx) => {
    if (!el) return;
    const elCenter = el.offsetLeft + el.offsetWidth / 2;
    const dist = Math.abs(center - elCenter);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

export default function VideoCarousel() {
  const trackRef = useRef(null);
  const slideRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [loadedSet, setLoadedSet] = useState(() => new Set());
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const isMobile = useMediaQuery(MOBILE_MQ);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_MQ);

  const markLoaded = useCallback((index) => {
    setLoadedSet((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const syncFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollPrev(track.scrollLeft > 4);
    setCanScrollNext(maxScroll > 4 && track.scrollLeft < maxScroll - 4);
    setActiveIndex(nearestIndex(track, slideRefs.current));
  }, []);

  const scrollToIndex = useCallback((index) => {
    const track = trackRef.current;
    const slide = slideRefs.current[index];
    if (!track || !slide) return;
    const offset = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, offset), behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [prefersReducedMotion]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => syncFromScroll();
    track.addEventListener("scroll", onScroll, { passive: true });
    syncFromScroll();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number(entry.target.dataset.index);
          if (!Number.isNaN(idx) && isMobile) markLoaded(idx);
        });
      },
      { root: track, rootMargin: "40px 0px", threshold: 0.15 },
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      track.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [isMobile, markLoaded, syncFromScroll]);

  const playingIndex = prefersReducedMotion
    ? null
    : isMobile
      ? activeIndex
      : hoveredIndex;

  useEffect(() => {
    if (playingIndex != null) markLoaded(playingIndex);
  }, [playingIndex, markLoaded]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(Math.max(0, activeIndex - 1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(Math.min(REPORT_SCENE_VIDEOS.length - 1, activeIndex + 1));
    }
  };

  return (
    <section
      className="video-carousel-section"
      aria-labelledby="video-carousel-heading"
    >
      <div className="video-carousel-section__inner">
        <div className="video-carousel-section__header">
          <span className="video-carousel-section__eyebrow">実際のシーン</span>
          <h2 id="video-carousel-heading" className="video-carousel-section__heading">
            AIが企業を認識し、比較し、行動するまで
          </h2>
          <p className="video-carousel-section__desc">
            AI検索・推薦・予約など、Agent Readiness が実際のユーザー体験に
            どう影響するのかを短い動画で紹介します。
          </p>
          <p className="video-carousel-section__hint">クリックで音声が流れます</p>
        </div>

        <div
          className="video-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label="Agent Readiness シーン動画"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {!isMobile && canScrollPrev && (
            <button
              type="button"
              className="video-carousel__nav video-carousel__nav--prev"
              aria-label="前の動画"
              onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
            >
              ‹
            </button>
          )}

          <div ref={trackRef} className="video-carousel__track">
            {REPORT_SCENE_VIDEOS.map((video, index) => {
              const shouldLoad = loadedSet.has(index);
              const isHovered = !isMobile && hoveredIndex === index;
              const isActive = activeIndex === index;

              return (
                <VideoCard
                  key={video.id}
                  video={video}
                  isHovered={isHovered}
                  isActive={isActive}
                  shouldLoad={shouldLoad}
                  isPlaying={playingIndex === index}
                  slideRef={(el) => {
                    slideRefs.current[index] = el;
                    if (el) el.dataset.index = String(index);
                  }}
                  onMouseEnter={() => {
                    if (isMobile) return;
                    setHoveredIndex(index);
                    markLoaded(index);
                  }}
                  onMouseLeave={() => {
                    if (isMobile) return;
                    setHoveredIndex((prev) => (prev === index ? null : prev));
                  }}
                />
              );
            })}
          </div>

          {!isMobile && canScrollNext && (
            <button
              type="button"
              className="video-carousel__nav video-carousel__nav--next"
              aria-label="次の動画"
              onClick={() => scrollToIndex(Math.min(REPORT_SCENE_VIDEOS.length - 1, activeIndex + 1))}
            >
              ›
            </button>
          )}

          <div className="video-carousel__dots" role="tablist" aria-label="動画ページ">
            {REPORT_SCENE_VIDEOS.map((video, index) => (
              <button
                key={video.id}
                type="button"
                role="tab"
                className={`video-carousel__dot${activeIndex === index ? " video-carousel__dot--active" : ""}`}
                aria-label={`${video.title}（${index + 1} / ${REPORT_SCENE_VIDEOS.length}）`}
                aria-selected={activeIndex === index}
                onClick={() => scrollToIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
