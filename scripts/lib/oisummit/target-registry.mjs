/**
 * OISUMMIT Capture target registry — single source for web UI and Grok sidecar.
 * Keep in sync with oisummit/capture/index.html `targets` array.
 */
export const OISUMMIT_CAPTURE_TARGETS = Object.freeze(
  [
    ['sagamihara', '相模原市', 'government', 'MUST', 'MAR', 'PUBLIC', 'DX推進課とのMAR Pilot Meeting'],
    ['biprogy', 'BIPROGY', 'company', 'MUST', 'AGENT_EXECUTION', 'TECH', 'AI/DX/R&Dとの30分Technical Meeting'],
    ['pacific_consultants', 'Pacific Consultants', 'partner', 'MUST', 'PARTNERSHIP', 'PUBLIC', '自治体共同Pilot/横展開Discussion'],
    ['yokohama', '横浜市', 'government', 'MUST', 'MAR', 'PUBLIC', 'External AI Readiness Benchmark'],
    ['goodpatch', 'Goodpatch', 'company', 'MUST', 'AGENT_READINESS', 'TECH', 'Agent-mediated UX Discussion'],
    ['hyogo', '兵庫県', 'government', 'MUST', 'MAR', 'PUBLIC', 'ひょうごTECH接続30分相談'],
    ['shizuoka_city', '静岡市', 'government', 'CORE', 'MAR', 'PUBLIC', 'DX推進課MAR Pilot'],
    ['toyama', '富山市', 'government', 'CORE', 'MAR', 'PUBLIC', 'データ連携Pilot'],
    ['salesforce_japan', 'Salesforce Japan', 'company', 'CORE', 'AGENT_READINESS', 'ENTERPRISE', 'Agentforce技術Discussion'],
    ['nssol', 'NSSOL', 'company', 'CORE', 'AGENT_EXECUTION', 'TECH', 'AI/金融/R&D Technical Discussion'],
    ['kanagawa', '神奈川県', 'government', 'CORE', 'MAR', 'PUBLIC', '県民Journey MAR Pilot'],
    ['eiicon', 'eiicon', 'partner', 'CORE', 'PARTNERSHIP', 'GENERAL', '紹介先1件'],
    ['shizuoka', '静岡県', 'government', 'CORE', 'MAR', 'PUBLIC', '県AI/DX担当30分'],
    ['gifu', '岐阜県', 'government', 'CORE', 'MAR', 'PUBLIC', 'AIナビゲーター外部評価'],
    ['daido_life', '大同生命', 'company', 'CORE', 'AGENT_EXECUTION', 'ENTERPRISE', 'DX戦略部/査定企画PoC'],
    ['nara', '奈良県', 'government', 'BACKUP', 'MAR', 'PUBLIC', '生成AI業務効率化＋外部評価'],
    ['yamanashi', '山梨県', 'government', 'BACKUP', 'MAR', 'PUBLIC', '生成AI人材→制度MAR'],
    ['mori_building', '森ビル', 'company', 'BACKUP', 'PARTNERSHIP', 'PUBLIC', '都市DX・横展開'],
    ['seino_holdings', 'セイノーホールディングス', 'company', 'BACKUP', 'AGENT_EXECUTION', 'ENTERPRISE', '輸送要件/Business Outcome'],
    ['tokyo', '東京都', 'government', 'BACKUP', 'MAR', 'PUBLIC', '都市サービス評価'],
  ].map(([id, name, type, priority, route, demo, goal]) =>
    Object.freeze({ id, name, type, priority, route, demo, goal }),
  ),
);

export function resolveCaptureTarget(rawName, targets = OISUMMIT_CAPTURE_TARGETS) {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  const exact = targets.find((t) => t.name.toLowerCase() === lower || t.id === lower);
  if (exact) return { kind: 'registered', target: exact };
  const partial = targets.find((t) => t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase()));
  if (partial) return { kind: 'registered', target: partial };
  return { kind: 'adhoc', name };
}

export function makeAdhocTargetId() {
  return `ADHOC_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
