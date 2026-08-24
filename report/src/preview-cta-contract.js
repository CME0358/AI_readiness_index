/** Safe, route-based public CTA contract shared by API projection and UI. */
export const CTA_ROUTES = Object.freeze({
  DIRECT_BUYER_V1: Object.freeze({ buyerType: "DIRECT_BUYER", destination: "https://localgeo.coaretail.com/", campaign: "direct_buyer" }),
  AGENCY_PARTNER_V1: Object.freeze({ buyerType: "AGENCY_PARTNER", destination: "https://readiness.coaretail.com/report/partner-preview/", campaign: "agency_partner" }),
});

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash ? url : null;
  } catch { return null; }
}

export function resolvePublicPreviewCta(snapshot) {
  const routeId = typeof snapshot?.route_id === "string" ? snapshot.route_id : "";
  const route = CTA_ROUTES[routeId];
  if (!route || snapshot?.buyer_type !== route.buyerType || snapshot?.cta_destination !== route.destination) return null;
  const destination = safeHttpsUrl(route.destination);
  const tracking = safeHttpsUrl(snapshot?.cta_tracking_url);
  if (!destination || !tracking || tracking.origin !== destination.origin || tracking.pathname !== destination.pathname) return null;
  const expected = { utm_source: "ari_preview", utm_medium: "outbound", utm_campaign: route.campaign, utm_content: routeId.toLowerCase() };
  if (tracking.searchParams.size !== Object.keys(expected).length) return null;
  for (const [key, value] of Object.entries(expected)) if (tracking.searchParams.get(key) !== value) return null;
  const query = tracking.search.toLowerCase();
  const sensitive = [snapshot?.company_name, snapshot?.url, snapshot?.candidate_id, snapshot?.token]
    .filter((value) => typeof value === "string" && value).map((value) => value.toLowerCase());
  if (sensitive.some((value) => query.includes(value))) return null;
  return Object.freeze({ routeId, buyerType: route.buyerType, destination: route.destination,
    trackingUrl: tracking.toString(), routingPolicyVersion: typeof snapshot?.routing_policy_version === "string" ? snapshot.routing_policy_version : "" });
}
