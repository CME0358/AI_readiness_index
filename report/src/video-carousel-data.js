/**
 * Report landing — vertical scene videos (9:16).
 *
 * Set `src` for MP4, or `embedUrl` for TikTok / iframe embed.
 * `href` opens the source page in a new tab when the card is clicked.
 */
function tiktokEmbed(videoId) {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}

export const REPORT_SCENE_VIDEOS = [
  {
    id: "01",
    title: "AI検索で見つかる",
    src: "",
    embedUrl: tiktokEmbed("7646962366919265543"),
    poster: "",
    href: "https://www.tiktok.com/@coaretail/video/7646962366919265543",
  },
  {
    id: "02",
    title: "比較候補に入る",
    src: "",
    embedUrl: tiktokEmbed("7646292578912046344"),
    poster: "",
    href: "https://www.tiktok.com/@coaretail/video/7646292578912046344",
  },
  {
    id: "03",
    title: "推薦される",
    src: "",
    embedUrl: tiktokEmbed("7645235826061839623"),
    poster: "",
    href: "https://www.tiktok.com/@coaretail/video/7645235826061839623",
  },
  {
    id: "04",
    title: "予約・問い合わせ",
    src: "",
    embedUrl: tiktokEmbed("7645235530610789639"),
    poster: "",
    href: "https://www.tiktok.com/@coaretail/video/7645235530610789639",
  },
  {
    id: "05",
    title: "行動までつながる",
    src: "",
    embedUrl: tiktokEmbed("7645235102615653640"),
    poster: "",
    href: "https://www.tiktok.com/@coaretail/video/7645235102615653640",
  },
];
