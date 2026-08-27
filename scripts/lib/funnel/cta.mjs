import { DIRECT_BUYER_TYPES, PARTNER_TYPES, SEGMENTS } from './segments.mjs';

const CTA_TYPES = Object.freeze({
  LEARN: 'LEARN',
  CHECK: 'CHECK',
  REPORT: 'REPORT',
  PARTNER: 'PARTNER',
  LOCAL: 'LOCAL',
});

const CTA_TYPE_VALUES = Object.freeze(Object.values(CTA_TYPES));

const CTA_DEFINITIONS = Object.freeze({
  LEARN: 'Research / Framework / Guide / Whitepaper',
  CHECK: 'Free ARI Check',
  REPORT: 'Company Report ¥29,800',
  PARTNER: 'Partner consultation / backend',
  LOCAL: 'Direct Buyer → localgeo',
});

const EXISTING_CTA_MAPPING = Object.freeze({
  'Frameworkを見る': CTA_TYPES.LEARN,
  'Researchを見る': CTA_TYPES.LEARN,
  '診断を申し込む': CTA_TYPES.REPORT,
  'Whitepaperを見る': CTA_TYPES.LEARN,
  '無料版レポート': CTA_TYPES.LEARN,
  'ARI診断': CTA_TYPES.REPORT,
  'Advisoryについて相談する': CTA_TYPES.PARTNER,
  'クライアントへの展開について相談': CTA_TYPES.PARTNER,
  'ARIレポートを確認する': CTA_TYPES.REPORT,
});

const PREVIEW_CLASSIFICATION_MAPPING = Object.freeze({
  AGENCY_PARTNER_V1: Object.freeze({
    segment: SEGMENTS.AGENT_PARTNER,
    partnerType: PARTNER_TYPES.AGENCY,
  }),
  AGENCY_PARTNER: Object.freeze({
    segment: SEGMENTS.AGENT_PARTNER,
    partnerType: PARTNER_TYPES.AGENCY,
  }),
  DIRECT_BUYER: Object.freeze({
    segment: SEGMENTS.DIRECT_BUYER,
    directBuyerType: DIRECT_BUYER_TYPES.UNKNOWN,
  }),
});

function createCtaMetadata({
  id,
  type,
  label,
  destination,
  persona = 'unknown',
  funnelStage = 'consideration',
  placement = 'unknown',
}) {
  if (!id || !CTA_TYPE_VALUES.includes(type) || !destination) return null;
  return Object.freeze({ id, type, label: label || '', destination, persona, funnelStage, placement });
}

function mapExistingCtaLabel(label) {
  return EXISTING_CTA_MAPPING[label] || null;
}

function mapPreviewClassification(previewStrategy) {
  const mapping = PREVIEW_CLASSIFICATION_MAPPING[previewStrategy];
  return mapping ? { ...mapping, directBuyerType: mapping.directBuyerType || null, partnerType: mapping.partnerType || null } : {
    segment: SEGMENTS.UNKNOWN,
    partnerType: PARTNER_TYPES.UNKNOWN,
    directBuyerType: DIRECT_BUYER_TYPES.UNKNOWN,
  };
}

export {
  CTA_TYPES,
  CTA_TYPE_VALUES,
  CTA_DEFINITIONS,
  EXISTING_CTA_MAPPING,
  PREVIEW_CLASSIFICATION_MAPPING,
  createCtaMetadata,
  mapExistingCtaLabel,
  mapPreviewClassification,
};
