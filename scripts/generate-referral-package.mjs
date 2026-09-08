#!/usr/bin/env node
/**
 * Generate P3-01 referral review package (markdown).
 * Usage: node scripts/generate-referral-package.mjs [--out referral/review]
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ASSET_INVENTORY, getInventorySummary } from './lib/referral/inventory.mjs';
import { businessInfoMarkdown } from './lib/referral/business-info.mjs';
import { EDITORIAL_MIX_P3, mixTotalPct, weeklySlotAllocation } from './lib/referral/editorial-mix.mjs';
import { LANDING_ROUTES, buildReferralUrl } from './lib/referral/landing-routes.mjs';
import { buildReferralRedirects, shortUrlForDraft } from './lib/referral/redirect-manifest.mjs';
import { POST_DRAFTS, resolveDraftBody, validateDraftForMedia } from './lib/referral/post-drafts.mjs';
import { validateReferralDestination, assertNoSidecarShortIdCollision } from './lib/referral/redirect-validator.mjs';
import { MEDIA_SPECS } from './lib/referral/constants.mjs';
import { readJson, REDIRECTS_PATH } from './x-traffic-sidecar/core.mjs';

function parseArgs(argv) {
  const args = { out: 'referral/review' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

function writeOut(dir, name, content) {
  writeFileSync(join(dir, name), content, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const outDir = resolve(args.out);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'drafts'), { recursive: true });

  const summary = getInventorySummary();
  const redirects = buildReferralRedirects();
  const sidecar = readJson(REDIRECTS_PATH, { redirects: [] });
  const collision = assertNoSidecarShortIdCollision(
    redirects.redirects.map((r) => r.short_id),
    (sidecar.redirects || []).map((r) => r.short_id),
  );

  writeOut(outDir, '01-inventory.md', `# 資産棚卸し（P3-01）

> ステータス: レビュー用。**掲載・送信済みではない。**

## サマリー
- 公開事例: ${summary.caseStudyCount}件
- 商用オファリング: ${summary.offeringCount}件
- 未確認条件: ${summary.unresolvedCount}件

## 組織・プロフィール
- 法人名: ${ASSET_INVENTORY.organization.legalName}
- 代表: ${ASSET_INVENTORY.organization.representative.name}（${ASSET_INVENTORY.organization.representative.title}）
- 相談URL: ${ASSET_INVENTORY.organization.consultUrl}

## 公開事例
${ASSET_INVENTORY.caseStudies.map((c) => `- **${c.displayName}** (${c.industry}) — ${c.permissionNote}`).join('\n')}

## 掲載可
${ASSET_INVENTORY.externalIntroAllowed.map((s) => `- ${s}`).join('\n')}

## 掲載不可
${ASSET_INVENTORY.externalIntroForbidden.map((s) => `- ${s}`).join('\n')}

## PR・イベント
${ASSET_INVENTORY.prAndEvents.map((p) => `- ${p.id}: ${p.note}`).join('\n')}
`);

  writeOut(outDir, '02-business-info-pack.md', businessInfoMarkdown());

  writeOut(outDir, '03-measurement-plan.md', `# 測定計画（P3-01）

## 着地先（対象別）

| 対象 | ラベル | 着地 | UTM campaign |
| --- | --- | --- | --- |
${LANDING_ROUTES.map((r) => {
  const url = buildReferralUrl(r, { content: `p3_${r.id}` });
  return `| ${r.audience} | ${r.label} | ${url} | ari_ref_${r.audience} |`;
}).join('\n')}

## /go/ 短縮URL（新規 — x-sidecar と非重複）

| short_id | 着地 |
| --- | --- |
${redirects.redirects.map((r) => `| ${r.short_id} | https://readiness.coaretail.com/go/${r.short_id} |`).join('\n')}

## 衝突チェック
- x-sidecar との short_id 重複: ${collision.ok ? 'なし' : collision.overlap.join(', ')}

## 計測
- GA4: \`landing_view\`, \`cta_click\`, \`service_view\`（P0-03 辞書）
- 商談: mtgschedule（booking_confirmed は not_connected）
- **既存 x-sidecar の short_id は再利用しない**

## 除外
- テスト/社内: \`traffic_type: internal\`, \`ari_debug=1\`, preview/vercel.app
`);

  writeOut(outDir, '04-editorial-mix.md', `# Insights/SNS 編集構成案（P3-01）

> **Buffer 予約済み投稿・本番枠は変更しない。**

## 目標
${EDITORIAL_MIX_P3.goal}

## 配分（合計 ${mixTotalPct()}%）
${Object.entries(EDITORIAL_MIX_P3.buckets).map(([k, b]) => `- **${b.label}** ${b.pct}% — ${b.examples.join('、')}`).join('\n')}

## 週10本の配分例
${Object.entries(weeklySlotAllocation(10)).map(([k, v]) => `- ${v.label}: ${v.slots}本`).join('\n')}
`);

  writeOut(outDir, '05-media-specs.md', `# 媒体別仕様

${Object.entries(MEDIA_SPECS).map(([k, s]) => `## ${k}\n${JSON.stringify(s, null, 2)}`).join('\n\n')}
`);

  for (const draft of POST_DRAFTS) {
    const shortUrl = shortUrlForDraft(draft.id);
    const validation = validateDraftForMedia(draft, { shortUrl });
    writeOut(
      join(outDir, 'drafts'),
      `${draft.id}.md`,
      `# ${draft.title}

- media: ${draft.media}
- bucket: ${draft.bucket}
- audience: ${draft.audience}
- validation: ${validation.ok ? 'PASS' : validation.errors.join('; ')}

---

${validation.body}
`,
    );
  }

  writeOut(outDir, '06-ops-runbook.md', `# 承認後運用手順

1. \`referral/review/\` の下書きを社内レビュー（許諾範囲・料金・事例表現）
2. 問題なければ \`insights/_social/referral/redirects.json\` の status を更新
3. SNS投稿は **手動** または既存 queue スクリプトで **新規枠** に投入（Buffer 予約済みは触らない）
4. 投稿本文に /go/ref* URL を含める（X は必須）
5. 週次: \`observation/\` + GA4/CRM エクスポートで商談導線を観測（P2-02）

**未実施として報告するもの:** 掲載、送信、予約投稿、広告出稿
`);

  const invalid = redirects.redirects.filter((r) => !validateReferralDestination(r.destination));
  console.log(JSON.stringify({
    ok: invalid.length === 0 && collision.ok,
    outDir,
    drafts: POST_DRAFTS.length,
    redirects: redirects.redirects.length,
    invalidRedirects: invalid.map((r) => r.short_id),
    sidecarCollision: collision.overlap,
  }, null, 2));
}

main();
