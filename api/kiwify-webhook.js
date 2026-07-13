'use strict';

const { getJson, setJson } = require('./_redis');

const TTL_SECONDS = 60 * 60 * 24 * 30;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function findEmail(value, depth = 0) {
  if (!value || depth > 6) return '';
  if (typeof value === 'string') {
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? normalize(match[0]) : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEmail(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key.toLowerCase().includes('email') && typeof item === 'string') {
        const found = findEmail(item, depth + 1);
        if (found) return found;
      }
    }
    for (const item of Object.values(value)) {
      const found = findEmail(item, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function extractText(body) {
  const candidates = [
    body?.event,
    body?.type,
    body?.status,
    body?.order_status,
    body?.webhook_event_type,
    body?.data?.status,
    body?.data?.event,
    body?.order?.status,
    body?.purchase?.status
  ];
  return candidates.filter(Boolean).join(' ').toLowerCase();
}

function isApproved(body) {
  const text = extractText(body);
  return [
    'approved', 'paid', 'completed', 'order_approved',
    'purchase_approved', 'aprovad', 'pagamento aprovado'
  ].some(term => text.includes(term));
}

function transactionId(body) {
  return String(
    body?.transaction_id || body?.order_id || body?.id ||
    body?.data?.transaction_id || body?.data?.order_id || body?.data?.id ||
    body?.order?.id || body?.purchase?.id || ''
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const expectedSecret = process.env.KIWIFY_WEBHOOK_SECRET;
    const receivedSecret = String(req.query?.secret || req.headers['x-webhook-secret'] || '');

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Webhook não autorizado.' });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = Object.fromEntries(new URLSearchParams(body));
      }
    }

    const productGuard = normalize(process.env.KIWIFY_PRODUCT_NAME || 'Mapa da Suspeita');
    const fullPayload = normalize(JSON.stringify(body));
    if (productGuard && !fullPayload.includes(productGuard)) {
      console.log('kiwify_ignored_product');
      return res.status(200).json({ received: true, ignored: 'product' });
    }

    if (!isApproved(body)) {
      console.log('kiwify_ignored_event', extractText(body));
      return res.status(200).json({ received: true, ignored: 'event' });
    }

    const email = findEmail(body);
    if (!email) {
      console.error('kiwify_missing_email');
      return res.status(422).json({ error: 'E-mail do comprador não encontrado.' });
    }

    const payment = {
      approvedAt: new Date().toISOString(),
      transactionId: transactionId(body),
      source: 'kiwify'
    };

    await setJson(`mapa:paid:${email}`, payment, TTL_SECONDS);

    const mapping = await getJson(`mapa:email:${email}`);
    if (mapping?.sessionId) {
      const session = await getJson(`mapa:session:${mapping.sessionId}`);
      if (session) {
        session.paid = true;
        session.payment = payment;
        session.updatedAt = payment.approvedAt;
        await setJson(`mapa:session:${mapping.sessionId}`, session, TTL_SECONDS);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('kiwify_webhook_error', error);
    const status = error.code === 'STORAGE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: 'Falha ao processar o webhook.' });
  }
};
