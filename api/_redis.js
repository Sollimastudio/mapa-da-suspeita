'use strict';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function assertConfigured() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    const error = new Error('Armazenamento ainda não configurado no Vercel.');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
}

async function command(...args) {
  assertConfigured();
  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });

  if (!response.ok) {
    throw new Error(`Falha no armazenamento: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function setJson(key, value, ttlSeconds = 2592000) {
  return command('SET', key, JSON.stringify(value), 'EX', String(ttlSeconds));
}

async function getJson(key) {
  const value = await command('GET', key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

module.exports = { command, setJson, getJson };
