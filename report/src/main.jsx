import React from "react";
import { createRoot } from "react-dom/client";
import "./report-design.css";
import "./video-carousel.css";
import App from "./agent-readiness-report.jsx";
import PreviewPage, { parsePreviewToken } from "./PreviewPage.jsx";

const previewToken = parsePreviewToken(window.location.pathname);
const Root = previewToken ? () => <PreviewPage token={previewToken} /> : App;

createRoot(document.getElementById("root")).render(<Root />);
