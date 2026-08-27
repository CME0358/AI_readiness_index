const PRODUCTION_ENV = Object.freeze({
  stripeSecretKey: 'STRIPE_SECRET_KEY',
  companyReportPaymentUrl: 'VITE_COMPANY_REPORT_BUNDLE_PAYMENT_URL',
  companyReportPaymentLinkId: 'COMPANY_REPORT_STRIPE_PAYMENT_LINK_ID',
  airtableApiKey: 'AIRTABLE_API_KEY',
  airtableBaseId: 'AIRTABLE_BASE_ID',
  airtableLeadsTable: 'AIRTABLE_TABLE_NAME',
  airtableConversionsTable: 'AIRTABLE_CONVERSIONS_TABLE_NAME',
  nurtureEnabled: 'NURTURE_ENABLED',
});

function isNurtureEnabled(env = process.env) {
  return String(env?.[PRODUCTION_ENV.nurtureEnabled] || '').toLowerCase() === 'true';
}

function getAirtableConfig(env = process.env) {
  return {
    apiKey: env?.[PRODUCTION_ENV.airtableApiKey] || '',
    baseId: env?.[PRODUCTION_ENV.airtableBaseId] || '',
    leadsTable: env?.[PRODUCTION_ENV.airtableLeadsTable] || 'Leads',
    conversionsTable: env?.[PRODUCTION_ENV.airtableConversionsTable] || '',
  };
}

export { PRODUCTION_ENV, isNurtureEnabled, getAirtableConfig };
