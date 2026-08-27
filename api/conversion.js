const { saveConversionToAirtable, findConversionByDedupeKey } = require('./_lib/airtable.js');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (String(process.env.CONVERSION_PERSISTENCE_ENABLED || 'true').toLowerCase() === 'false') return send(res, 503, { error: 'conversion_persistence_disabled' });
  try {
    const { createConversion, createConversionRepository } = await import('../scripts/lib/funnel/conversions.mjs');
    const input = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (input.conversionType === 'REPORT_PURCHASE') return send(res, 403, { error: 'report_purchase_requires_server_verification' });
    const repository = createConversionRepository({ saveConversion: saveConversionToAirtable, findConversion: findConversionByDedupeKey });
    const result = await repository.saveConversion(input);
    if (result.duplicate) return send(res, 200, { ok: true, duplicate: true });
    if (!result.saved) return send(res, 503, { error: 'conversion_persistence_unavailable', reason: result.reason });
    return send(res, 201, { ok: true, conversionType: result.key?.split(':')[0] || createConversion(input)?.conversionType || null });
  } catch {
    return send(res, 400, { error: 'invalid_conversion' });
  }
};
