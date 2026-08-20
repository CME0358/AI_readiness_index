import React from "react";
import { createRoot } from "react-dom/client";
import "./report-design.css";
import "./video-carousel.css";
import App from "./agent-readiness-report.jsx";
import PreviewPage, { parsePreviewToken } from "./PreviewPage.jsx";
import PartnerPreviewPage, { isPartnerPreviewPath } from "./PartnerPreviewPage.jsx";

const pathname = window.location.pathname;
const partnerPreview = isPartnerPreviewPath(pathname);
const previewToken = partnerPreview ? null : parsePreviewToken(pathname);

const Root = partnerPreview
  ? () => <PartnerPreviewPage />
  : previewToken
    ? () => <PreviewPage token={previewToken} />
    : App;

createRoot(document.getElementById("root")).render(<Root />);
