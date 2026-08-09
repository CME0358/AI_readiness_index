/** Shared design tokens for Report SPA — mirrors assets/design-system.css */
export const MTG_SCHEDULE_URL = "https://www.coaretail.com/readiness/mtgschedule";
export const IMPROVE_URL = "/improve.html";

/** Score bar fill variants — accent family only (no black fills) */
export const SCORE_BAR_VARIANTS = {
  accent: "accent",
  accentMid: "accent-mid",
  accentMuted: "accent-muted",
};

export const reportShell = {
  fontFamily: "var(--font-sans)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
};

export const reportContainer = {
  maxWidth: "var(--container-max)",
  margin: "0 auto",
  padding: "0 var(--container-gutter)",
};

export const reportReading = {
  maxWidth: "var(--container-reading)",
  margin: "0 auto",
};

export function scoreInterpretation(report, isSampleReport) {
  if (isSampleReport) {
    return "サンプルデータに基づく評価です。実購入レポートでは自社サイト解析とライブAI観測に基づきます。";
  }
  const first = report.executiveSummary?.split("\n").map((s) => s.trim()).find(Boolean);
  if (first && first.length <= 220) return first;
  if (first) return `${first.slice(0, 217)}…`;
  return `${report.level}レベルの評価です。Evidence → Interpretation → Decision の順に確認してください。`;
}

export function mapProposalToPriority(item, index, roadmap = []) {
  const match = roadmap.find((r) => r.action === item.title);
  return {
    title: item.title,
    why: item.description,
    impact: match?.impact ? `改善幅 ${match.impact}` : null,
    action: match?.effort || "改善ロードマップの施策として優先検討",
    rank: index + 1,
  };
}
