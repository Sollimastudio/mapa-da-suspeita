'use strict';

const { getJson, setJson } = require('./_redis');

const TTL_SECONDS = 60 * 60 * 24 * 30;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = normalizeEmail(body.email);
    const sessionId = String(body.sessionId || '').trim();

    if (!email || !sessionId) {
      return res.status(400).json({ error: 'Sessão ou e-mail ausente.' });
    }

    const session = await getJson(`mapa:session:${sessionId}`);
    if (!session || session.email !== email) {
      return res.status(404).json({ error: 'Não encontramos este teste.' });
    }

    if (!session.paid) {
      const approved = await getJson(`mapa:paid:${email}`);
      if (approved) {
        session.paid = true;
        session.payment = approved;
        session.updatedAt = new Date().toISOString();
        await setJson(`mapa:session:${sessionId}`, session, TTL_SECONDS);
      }
    }

    if (!session.paid) {
      return res.status(200).json({ status: 'pending' });
    }

    return res.status(200).json({
      status: 'paid',
      state: session.state,
      paidAt: session.payment?.approvedAt || session.updatedAt
    });
  } catch (error) {
    console.error('status_error', error);
    const status = error.code === 'STORAGE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({
      error: status === 503
        ? 'A integração de armazenamento ainda precisa ser ativada.'
        : 'Não foi possível confirmar o pagamento.'
    });
  }
};
