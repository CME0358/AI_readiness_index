/**
 * /api/verify-purchase — Stripe Checkout Session verification (server-only).
 *
 * Requires STRIPE_SECRET_KEY (never expose to client).
 * Graceful 503 when unconfigured — client falls back to legacy flow with limitations.
 */

import {
  resolveProductFromStripeSession,
  resolveCompanyReportProductFromStripeSession,
  buildVerifiedPurchaseState,
} from '../scripts/lib/fulfillment-state.mjs';

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function retrieveCheckoutSession(sessionId, secretKey) {
  const endpoint = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`;
  const ac = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
    ...(ac ? { signal: ac } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe API ${res.status}`);
    err.status = res.status;
    err.stripe = data?.error;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({
      error: 'verification_unconfigured',
      message: 'STRIPE_SECRET_KEY is not configured. Server-side purchase verification unavailable.',
    }));
    return;
  }

  try {
    const body = await readBody(req);
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    const productHint = String(body.productHint || body.productId || 'company_report').trim();

    if (!sessionId || !sessionId.startsWith('cs_')) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'invalid_session_id' }));
      return;
    }

    const session = await retrieveCheckoutSession(sessionId, secretKey);
    if (session.payment_status !== 'paid') {
      res.statusCode = 402;
      res.end(JSON.stringify({
        error: 'payment_not_completed',
        paymentStatus: session.payment_status,
      }));
      return;
    }

    const product = productHint === 'company_report'
      ? resolveCompanyReportProductFromStripeSession(session, {
        expectedPaymentLinkId: process.env.COMPANY_REPORT_STRIPE_PAYMENT_LINK_ID,
      })
      : resolveProductFromStripeSession(session, productHint);
    if (!product) {
      res.statusCode = 422;
      res.end(JSON.stringify({
        error: 'product_unresolved',
        amountTotal: session.amount_total,
        productHint,
      }));
      return;
    }

    const purchase = buildVerifiedPurchaseState(session, product);

    if (product.id === 'company_report_bundle' || product.id === 'company_report_legacy' || product.id === 'company_report') {
      try {
        const { createConversion, createConversionRepository } = await import('../scripts/lib/funnel/conversions.mjs');
        const { saveConversionToAirtable, findConversionByDedupeKey } = await import('./_lib/airtable.cjs');
        const repository = createConversionRepository({ saveConversion: saveConversionToAirtable, findConversion: findConversionByDedupeKey });
        await repository.saveConversion(createConversion({ conversionType: 'REPORT_PURCHASE', leadId: String(body.leadId || ''), externalReference: session.id, segment: 'AGENT_PARTNER', sourcePage: '/report/' }));
      } catch { /* conversion persistence failure must not revoke verified access */ }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      verified: true,
      purchase,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        fulfillmentState: product.fulfillmentState,
      },
    }));
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    res.statusCode = status;
    res.end(JSON.stringify({
      error: 'verification_failed',
      message: e?.message || 'Verification failed',
    }));
  }
}

export {
  retrieveCheckoutSession,
  resolveProductFromStripeSession,
  resolveCompanyReportProductFromStripeSession,
};
