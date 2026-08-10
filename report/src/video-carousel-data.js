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
