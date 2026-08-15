/**
 * video-segment.mjs — JS parity for preview video_segment classification.
 */

export const VIDEO_SEGMENTS = ['dental', 'clinic', 'tax', 'membership', 'estate'];

const DENTAL = ['歯科', '歯科医院', '歯科クリニック', '矯正歯科', '審美歯科', 'インプラント'];
const CLINIC = ['美容クリニック', '美容皮膚科', '美容外科', '医療脱毛', 'AGA', '自由診療'];
const TAX = ['税理士', '会計事務所', '会計士'];
const ESTATE = ['不動産'];
const MEMBERSHIP = ['パーソナルジム', 'フィットネス', 'ピラティス', 'ヨガ', 'スクール', '会員制'];

/** @param {string | null | undefined} segment */
export function normalizeVideoSegment(segment) {
  const value = String(segment || '').trim() || 'membership';
  if (value === 'generic') return 'membership';
  if (VIDEO_SEGMENTS.includes(value)) return value;
  return 'membership';
}

/** @param {string | null | undefined} industry */
export function classifyVideoSegment(industry) {
  const text = String(industry || '').trim();
  if (!text) return 'membership';
  if (DENTAL.some((kw) => text.includes(kw))) return 'dental';
  if (CLINIC.some((kw) => text.includes(kw))) return 'clinic';
  if (TAX.some((kw) => text.includes(kw))) return 'tax';
  if (ESTATE.some((kw) => text.includes(kw))) return 'estate';
  if (MEMBERSHIP.some((kw) => text.includes(kw))) return 'membership';
  return 'membership';
}
