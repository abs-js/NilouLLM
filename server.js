/**
 * Nilou 0.0.0 - Server
 * POST / { m, q, c } → { r, t }
 * Always next-word until </s>
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BasicLanguageModel } from './src/model.js';
import { log } from './src/utils.js';
import { initDb, db } from './src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL_NAME = 'Nilou 0.0.0';

const token = process.argv[2] || process.env.SUPABASE_KEY;
initDb(token);

const nilou = new BasicLanguageModel({ mode: 'normal', n: 2, temperature: 0.5, maxTokens: 100 });

const MAX_TOKENS_PER_REQUEST = 120;
const MAX_REQUESTS_PER_MINUTE = 30;

const stats = {
  totalRequests: 0, totalTokens: 0, dailyRequests: 0,
  dailyReset: new Date().toISOString().slice(0, 10),
  requestsPerMinute: [], tokensPerMinute: [], recentRequests: [],
  startTime: Date.now(), lastRequestTime: Date.now(),
  isTraining: false, trainingCycles: 0
};

const IDLE_TRAIN_MS = 5 * 60 * 1000;

function canAcceptRequest() {
  const now = Date.now();
  return stats.requestsPerMinute.filter(t => t > now - 60000).length < MAX_REQUESTS_PER_MINUTE;
}

function recordRequest(input, output, tokens) {
  const now = Date.now();
  stats.lastRequestTime = now;
  stats.isTraining = false;
  stats.totalRequests++;
  stats.dailyRequests++;
  stats.totalTokens += tokens;
  stats.requestsPerMinute.push(now);
  stats.tokensPerMinute.push({ t: now, tokens });
  stats.requestsPerMinute = stats.requestsPerMinute.filter(t => t > now - 3600000);
  stats.recentRequests.unshift({ time: new Date().toISOString(), input: input.slice(0,60), output: output.slice(0,100), tokens });
  if (stats.recentRequests.length > 40) stats.recentRequests.pop();
}

function getStats() {
  const now = Date.now();
  const rpm = stats.requestsPerMinute.filter(t => t > now - 60000).length;
  return {
    model: MODEL_NAME,
    uptime: Math.floor((now - stats.startTime)/1000),
    totalRequests: stats.totalRequests,
    dailyRequests: stats.dailyRequests,
    totalTokens: stats.totalTokens,
    requestsPerMinute: rpm,
    maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
    maxTokensPerRequest: MAX_TOKENS_PER_REQUEST,
    recentRequests: stats.recentRequests.slice(0,15),
    knowledgeTopics: nilou.knowledge.length,
    isTraining: stats.isTraining,
    trainingCycles: stats.trainingCycles,
    idleSeconds: Math.floor((now - stats.lastRequestTime)/1000)
  };
}

async function saveInteraction(q, r, tokens) {
  try {
    const key = `Nilou000_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await db('set', 'nilou_logs', key, { q, r, tokens, m: MODEL_NAME, timestamp: new Date().toISOString() });
  } catch(e) {}
}

setInterval(() => {
  if (Date.now() - stats.lastRequestTime >= IDLE_TRAIN_MS && !stats.isTraining) {
    stats.isTraining = true;
    stats.trainingCycles++;
    try { nilou.train(); } catch(e) {}
    setTimeout(() => { stats.isTraining = false; }, 20000);
  }
}, 30000);

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = path.join(__dirname, 'index.html');
    if (fs.existsSync(html)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(html));
    }
  }

  if (req.method === 'GET' && req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getStats()));
  }

  if (req.method === 'POST' && req.url === '/') {
    if (!canAcceptRequest()) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Too many requests' }));
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body || '{}'); }
    catch { res.writeHead(400); return res.end(JSON.stringify({ error: 'Invalid JSON' })); }

    const q = (input.q || '').toString().trim();
    const c = input.c || {};
    if (!q) { res.writeHead(400); return res.end(JSON.stringify({ error: 'q required' })); }

    const maxTok = Math.min(parseInt(c.maxTokens) || MAX_TOKENS_PER_REQUEST, MAX_TOKENS_PER_REQUEST);
    const result = nilou.generateUntilEnd(q, maxTok);

    recordRequest(q, result.text, result.tokens);
    saveInteraction(q, result.text, result.tokens).catch(()=>{});

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ r: result.text, t: result.tokens }, null, 2));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Nilou ${MODEL_NAME} on ${PORT}`);
  console.log(`POST / {m,q,c} → {r,t} | max ${MAX_REQUESTS_PER_MINUTE}/min`);
  log('Server started');
});
