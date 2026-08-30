import { timingSafeEqual } from "node:crypto";

const ALLOWED = {
  result: new Set(["HOT", "WARM", "CONTACT", "MISS"]),
  next_action: new Set(["MEETING", "INTRO", "MATERIAL", "FOLLOW", "NONE"]),
  due: new Set(["9/14", "9/15", "9/16", "CUSTOM", "NONE"]),
  contact_method: new Set(["BUSINESS_CARD", "EMAIL", "LINKEDIN", "QR", "OTHER", "NONE"]),
  route: new Set(["AGENT_EXECUTION", "AGENT_READINESS", "MAR", "PARTNERSHIP"]),
  priority: new Set(["MUST", "CORE", "BACKUP"]),
  target_type: new Set(["company", "government", "partner", "other"]),
};

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

function authMatches(req) {
  const expected = process.env.OISUMMIT_CAPTURE_ACCESS_TOKEN || "";
  const presented = req.headers?.authorization || "";
  if (!expected || !presented) return false;
  const expectedBytes = Buffer.from(`Bearer ${expected}`, "utf8");
  const presentedBytes = Buffer.from(presented, "utf8");
  return expectedBytes.length === presentedBytes.length && timingSafeEqual(expectedBytes, presentedBytes);
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return null; }
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function airtableRequest(baseId, table, apiKey, path = "", init = {}) {
  const endpoint = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
  });
  return response;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }
  if (!authMatches(req)) {
    json(res, 401, { error: "unauthorized" });
    return;
  }

  const enabled = process.env.OISUMMIT_CAPTURE_WRITE_ENABLED === "true";
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.OISUMMIT_CAPTURES_TABLE_NAME;
  if (!enabled || !apiKey || !baseId || !table) {
    json(res, 503, { error: "CONFIG_REQUIRED" });
    return;
  }

  const input = await readBody(req);
  if (!input) {
    json(res, 400, { error: "invalid_json" });
    return;
  }

  const captureId = clean(input.capture_id, 100);
  const targetId = clean(input.target_id, 100);
  const targetName = clean(input.target_name, 160);
  const result = clean(input.result, 20);
  if (!captureId || !targetId || !targetName || !ALLOWED.result.has(result)) {
    json(res, 400, { error: "target_id_target_name_and_result_required" });
    return;
  }
  if (!ALLOWED.route.has(clean(input.route, 40)) ||
      !ALLOWED.priority.has(clean(input.priority, 20)) ||
      !ALLOWED.target_type.has(clean(input.target_type, 20))) {
    json(res, 400, { error: "invalid_target_metadata" });
    return;
  }

  const fields = {
    capture_id: captureId,
    event: "OISUMMIT_2026",
    captured_at: clean(input.captured_at, 80) || new Date().toISOString(),
    target_id: targetId,
    target_name: targetName,
    target_type: clean(input.target_type, 20),
    priority: clean(input.priority, 20),
    route: clean(input.route, 40),
    person: clean(input.person, 160),
    department_title: clean(input.department_title, 200),
    result,
    memo: clean(input.memo, 300),
    next_action: ALLOWED.next_action.has(clean(input.next_action, 20)) ? clean(input.next_action, 20) : "NONE",
    due: ALLOWED.due.has(clean(input.due, 20)) ? clean(input.due, 20) : "NONE",
    contact_method: ALLOWED.contact_method.has(clean(input.contact_method, 30)) ? clean(input.contact_method, 30) : "NONE",
    source: "oisummit_capture",
    created_at: new Date().toISOString(),
  };

  try {
    const formula = encodeURIComponent(`{capture_id}='${captureId.replace(/'/g, "\\'")}'`);
    const existing = await airtableRequest(baseId, table, apiKey, `?maxRecords=1&filterByFormula=${formula}`);
    if (!existing.ok) {
      json(res, 502, { error: "airtable_lookup_failed" });
      return;
    }
    const existingBody = await existing.json();
    if (existingBody.records?.length) {
      json(res, 200, { saved: true, duplicate: true, capture_id: captureId });
      return;
    }

    const created = await airtableRequest(baseId, table, apiKey, "", {
      method: "POST",
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (!created.ok) {
      json(res, 502, { error: "airtable_write_failed" });
      return;
    }
    json(res, 201, { saved: true, duplicate: false, capture_id: captureId });
  } catch (error) {
    console.error("[oisummit-capture]", error?.message || error);
    json(res, 502, { error: "storage_unavailable" });
  }
}
