/**
 * Nilou 0.0.0 - Servidor API
 * 
 * Endpoint: POST /
 * Body: { "q": "pergunta", "m": "Nilou 0.0.0" }
 * Resposta: { "r": "...", "tokens": 42, "m": "Nilou 0.0.0" }
 */

import http from 'http';
import { BasicLanguageModel } from './src/model.js';
import { log } from './src/utils.js';
import { db } from './src/db.js';

const PORT = process.env.PORT || 3000;
const MODEL_NAME = 'Nilou 0.0.0';

const nilou = new BasicLanguageModel({
  mode: 'normal',
  n: 2,
  temperature: 0.5,
  thinkingRounds: 1,
  revisionSteps: 1
});

function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function saveInteraction(q, r, tokens) {
  try {
    const key = `Nilou000_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db('set', 'nilou_logs', key, {
      q, r, tokens, m: MODEL_NAME, timestamp: new Date().toISOString()
    });
    log(`Salvo no DB: ${key}`);
  } catch (err) {
    console.error('Erro ao salvar no DB:', err.message);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== 'POST' || req.url !== '/') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Use POST / com JSON {q, m}' }));
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  let input;
  try {
    input = JSON.parse(body || '{}');
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'JSON inválido' }));
  }

  const q = (input.q || '').toString().trim();
  const m = (input.m || MODEL_NAME).toString();

  if (!q) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Campo "q" é obrigatório' }));
  }

  const answer = nilou.answer(q);
  const tokens = countTokens(q) + countTokens(answer);

  const response = { r: answer, tokens, m: MODEL_NAME };

  saveInteraction(q, answer, tokens).catch(() => {});

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(response, null, 2));
});

server.listen(PORT, () => {
  console.log(`\n=== Nilou ${MODEL_NAME} rodando ===`);
  console.log(`API: POST http://localhost:${PORT}/`);
  log(`Servidor Nilou iniciado na porta ${PORT}`);
});
