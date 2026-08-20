import React from "react";

export const PREVIEW_STATUS_LABEL = {
  pass: { text: "確認済", color: "#16A34A", bg: "#ECFDF5" },
  warn: { text: "要確認", color: "#D97706", bg: "#FFFBEB" },
  unknown: { text: "未確認", color: "#6B7280", bg: "#F3F4F6" },
};

export function CheckBadge({ status }) {
  const meta = PREVIEW_STATUS_LABEL[status] || PREVIEW_STATUS_LABEL.unknown;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        color: meta.color,
        background: meta.bg,
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      {meta.text}
    </span>
  );
}
