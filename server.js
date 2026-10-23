/**
 * Nilou 0.0.0 - Server + Dashboard + Auto-training
 * 
 * Uso:
 *   node server.js "seu_token_supabase"
 *   ou defina SUPABASE_KEY no ambiente
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

const nilou = new BasicLanguageModel({
  mode: 'normal',
  n: 2,
  temperature: 0.5
});

const stats = {
  totalRequests: 0,
  totalTokens: 0,
  dailyRequests: 0,
  dailyReset: new Date().toISOString().slice(0, 10),
  requestsPerMinute: [],
  tokensPerMinute: [],
  recentRequests: [],
  startTime: Date.now(),
  lastRequestTime: Date.now(),
  isTraining: false,
  trainingCycles: 0
};

const IDLE_TRAIN_MS = 5 * 60 * 1000;

function resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (stats.dailyReset !== today) {
    stats.dailyRequests = 0;
    stats.dailyReset = today;
  }
}

function recordRequest(input, output, tokens, type) {
  resetDailyIfNeeded();
  const now = Date.now();
  stats.lastRequestTime = now;
  stats.isTraining = false;

  stats.totalRequests++;
  stats.dailyRequests++;
  stats.totalTokens += tokens;

  stats.requestsPerMinute.push(now);
  stats.tokensPerMinute.push({ t: now, tokens });

  const oneHourAgo = now - 60 * 60 * 1000;
  stats.requestsPerMinute = stats.requestsPerMinute.filter(t => t > oneHourAgo);
  stats.tokensPerMinute = stats.tokensPerMinute.filter(x => x.t > oneHourAgo);

  stats.recentRequests.unshift({
    time: new Date().toISOString(),
    type,
    input: input.slice(0, 80),
    output: output.slice(0, 120),
    tokens
  });
  if (stats.recentRequests.length > 50) stats.recentRequests.pop();
}

function getStats() {
  resetDailyIfNeeded();
  const now = Date.now();
  const oneMinAgo = now - 60 * 1000;
  const rpm = stats.requestsPerMinute.filter(t => t > oneMinAgo).length;
  const tpm = stats.tokensPerMinute.filter(x => x.t > oneMinAgo).reduce((s, x) => s + x.tokens, 0);
  const idleMs = now - stats.lastRequestTime;

  return {
    model: MODEL_NAME,
    uptime: Math.floor((now - stats.startTime) / 1000),
    totalRequests: stats.totalRequests,
    dailyRequests: stats.dailyRequests,
    totalTokens: stats.totalTokens,
    requestsPerMinute: rpm,
    tokensPerMinute: tpm,
    tokensPerSecond: Math.round(tpm / 60 * 10) / 10,
    recentRequests: stats.recentRequests.slice(0, 20),
    knowledgeTopics: nilou.knowledge.length,
    vocabularySize: nilou.vocabulary.size,
    isTraining: stats.isTraining,
    trainingCycles: stats.trainingCycles,
    idleSeconds: Math.floor(idleMs / 1000)
  };
}

function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function saveInteraction(input, output, tokens, type, lang) {
  try {
    const key = `Nilou000_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db('set', 'nilou_logs', key, {
      input, output, tokens, type, lang, m: MODEL_NAME, timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('DB save error:', err.message);
  }
}

function startAutoTrainLoop() {
  setInterval(() => {
    const idle = Date.now() - stats.lastRequestTime;
    if (idle >= IDLE_TRAIN_MS && !stats.isTraining) {
      stats.isTraining = true;
      stats.trainingCycles++;
      log(`[Auto-train] Iniciando ciclo #${stats.trainingCycles} (ocioso há ${Math.floor(idle/1000)}s)`);
      try {
        nilou.train();
        log(`[Auto-train] Ciclo #${stats.trainingCycles} concluído`);
      } catch (e) {
        log(`[Auto-train] Erro: ${e.message}`);
      }
      setTimeout(() => {
        if (Date.now() - stats.lastRequestTime >= IDLE_TRAIN_MS) {
          stats.isTraining = false;
        }
      }, 30000);
    }
  }, 30000);
}

startAutoTrainLoop();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath));
    }
  }

  if (req.method === 'GET' && req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getStats()));
  }

  if (req.method === 'POST' && req.url === '/') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try {
      input = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }

    const text = (input.r || input.q || '').toString().trim();
    const t = (input.t || 'Response').toString();
    const l = (input.l || 'en_US').toString();
    const m = (input.m || MODEL_NAME).toString();

    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Field "r" is required' }));
    }

    let output = '';
    let extra = {};

    if (t === 'NextWord') {
      const pred = nilou.nextWord(text);
      output = pred.word;
      extra = { confidence: pred.confidence, context: pred.context };
    } else {
      output = nilou.answer(text);
    }

    const tokens = countTokens(text) + countTokens(output);
    recordRequest(text, output, tokens, t);
    saveInteraction(text, output, tokens, t, l).catch(() => {});

    const response = { r: output, tokens, m: MODEL_NAME, t, l, ...extra };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(response, null, 2));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n=== Nilou ${MODEL_NAME} ===`);
  console.log(`Dashboard: http://localhost:${PORT}/`);
  console.log(`API:       POST http://localhost:${PORT}/`);
  console.log(`Auto-train: ativa após 5 min de inatividade`);
  if (!token) console.log(`Aviso: nenhum token DB fornecido`);
  log(`Servidor iniciado na porta ${PORT}`);
});
