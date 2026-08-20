/**
 * Agency Partner Preview routing helpers (Node-testable, no JSX).
 */

export function isPartnerPreviewPath(pathname = "") {
  const base = String(pathname).split("?")[0].split("#")[0];
  return /\/report\/partner-preview\/?$/.test(base)
    || /\/partner-preview\/?$/.test(base);
}

export function parsePreviewToken(pathname = "") {
  const base = String(pathname).split("?")[0].split("#")[0];
  const match = base.match(/\/report\/p\/([^/]+)/) || base.match(/\/p\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
