'use strict';

const crypto = require('crypto');
const { setJson } = require('./_redis');

const TTL_SECONDS = 60 * 60 * 24 * 30;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    const state = body.state || {};

    if (!isEmail(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    if (!Array.isArray(state.a) || state.a.length !== 10) {
      return res.status(400).json({ error: 'Respostas incompletas.' });
    }

    if (![1, 2, 3, 4].includes(Number(state.profile))) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const session = {
      id: sessionId,
      email,
      paid: false,
      createdAt: now,
      updatedAt: now,
      state: {
        a: state.a.map(value => Number(value)),
        need: String(state.need || ''),
        scores: {
          a: Number(state.scores?.a || 0),
          b: Number(state.scores?.b || 0),
          c: Number(state.scores?.c || 0)
        },
        profile: Number(state.profile),
        mod: String(state.mod || '')
      }
    };

    await Promise.all([
      setJson(`mapa:session:${sessionId}`, session, TTL_SECONDS),
      setJson(`mapa:email:${email}`, { sessionId }, TTL_SECONDS)
    ]);

    return res.status(201).json({ sessionId });
  } catch (error) {
    console.error('session_error', error);
    const status = error.code === 'STORAGE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({
      error: status === 503
        ? 'A integração de armazenamento ainda precisa ser ativada.'
        : 'Não foi possível preparar seu checkout. Tente novamente.'
    });
  }
};
