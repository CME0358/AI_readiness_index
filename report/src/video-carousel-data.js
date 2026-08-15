/**
 * Report landing — vertical scene videos (9:16).
 *
 * Set `src` for MP4/MOV, or `embedUrl` for TikTok / iframe embed.
 * Files live in report/public/scene-videos/ → /report/scene-videos/ at runtime.
 */
const SCENE_BASE = "/report/scene-videos";

export const REPORT_SCENE_VIDEOS = [
  {
    id: "01",
    title: "AI検索で見つかる",
    src: `${SCENE_BASE}/scene-01-ai-search.mp4`,
    embedUrl: "",
    poster: "",
    href: "",
  },
  {
    id: "02",
    title: "比較候補に入る",
    src: `${SCENE_BASE}/scene-02-compare.mov`,
    embedUrl: "",
    poster: "",
    href: "",
  },
  {
    id: "03",
    title: "推薦される",
    src: `${SCENE_BASE}/scene-03-recommend.mov`,
    embedUrl: "",
    poster: "",
    href: "",
  },
  {
    id: "04",
    title: "予約・問い合わせ",
    src: `${SCENE_BASE}/scene-04-booking.mov`,
    embedUrl: "",
    poster: "",
    href: "",
  },
  {
    id: "05",
    title: "行動までつながる",
    src: `${SCENE_BASE}/scene-05-action.mov`,
    embedUrl: "",
    poster: "",
    href: "",
  },
];

/**
 * Preview /report/p/{token} — maps segment → REPORT_SCENE_VIDEOS id (single source).
 *
 * membership / その他・ピラティス・ジム → scene-01-ai-search.mp4
 * estate / 不動産                     → scene-02-compare.mov
 * tax / 税理士・士業                  → scene-03-recommend.mov
 * dental / 歯科                       → scene-04-booking.mov
 * clinic / 美容クリニック             → scene-05-action.mov
 *
 * legacy `generic` resolves to membership (scene-01).
 */
export const PREVIEW_VIDEO_SEGMENT_TO_SCENE_ID = {
  membership: "01",
  estate: "02",
  tax: "03",
  dental: "04",
  clinic: "05",
};

const SCENE_BY_ID = Object.fromEntries(REPORT_SCENE_VIDEOS.map((v) => [v.id, v]));

/** @param {string | null | undefined} segment */
export function normalizePreviewVideoSegment(segment) {
  const value = String(segment || "").trim() || "membership";
  if (value === "generic") return "membership";
  if (PREVIEW_VIDEO_SEGMENT_TO_SCENE_ID[value]) return value;
  return "membership";
}

/** @param {string | null | undefined} segment */
export function resolvePreviewVideo(segment) {
  const key = normalizePreviewVideoSegment(segment);
  const sceneId = PREVIEW_VIDEO_SEGMENT_TO_SCENE_ID[key];
  return SCENE_BY_ID[sceneId] || SCENE_BY_ID[PREVIEW_VIDEO_SEGMENT_TO_SCENE_ID.membership];
}
