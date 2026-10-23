/**
 * Nilou Server - Express + Auth + API Keys
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { BasicLanguageModel } from './src/model.js';
import { initDb, db } from './src/db.js';
import {
  registerUser, verifyUser, login, createApiKey,
  validateKey, getLimits, ensureAdmin, updateKeyPassword,
  deleteKey, deleteUser
} from './src/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const token = process.argv[2] || process.env.SUPABASE_KEY;
initDb(token);

const nilou = new BasicLanguageModel({ n: 2, temperature: 0.5, maxTokens: 120 });
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const keyUsage = new Map();

function checkRateLimit(keyData) {
  const limits = getLimits(keyData);
  if (limits.unlimited) return true;
  const now = Date.now();
  const id = keyData.key;
  if (!keyUsage.has(id)) keyUsage.set(id, { requests: [], tokens: [] });
  const u = keyUsage.get(id);
  u.requests = u.requests.filter(t => t > now - 60000);
  u.tokens = u.tokens.filter(x => x.t > now - 60000);
  if (u.requests.length >= limits.reqPerMin) return false;
  const tokensMin = u.tokens.reduce((s, x) => s + x.tokens, 0);
  if (tokensMin >= limits.tokensPerMin) return false;
  return true;
}

function recordKeyUsage(keyData, tokens) {
  const id = keyData.key;
  if (!keyUsage.has(id)) keyUsage.set(id, { requests: [], tokens: [] });
  const u = keyUsage.get(id);
  const now = Date.now();
  u.requests.push(now);
  u.tokens.push({ t: now, tokens });
}

app.post('/api/register', async (req, res) => {
  try {
    const { nickname, email, password, captcha } = req.body;
    if (!nickname || !email || !password) return res.status(400).json({ error: 'Campos obrigatórios' });
    if (captcha !== 'nilou') return res.status(400).json({ error: 'Captcha incorreto (digite nilou)' });
    const result = await registerUser(nickname, email, password);
    res.json({ ok: true, email: result.email, verifyCode: result.verifyCode });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/verify', async (req, res) => {
  try {
    await verifyUser(req.body.email, req.body.code);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const user = await login(req.body.email, req.body.password);
    res.json({ ok: true, user });
  } catch (e) { res.status(401).json({ error: e.message }); }
});

app.post('/api/create-key', async (req, res) => {
  try {
    const result = await createApiKey(req.body.email, req.body.name || 'Minha chave', req.body.model || 'Nilou 0.0.0', req.body.password || '');
    res.json({ ok: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/update-key-password', async (req, res) => {
  try {
    const { apiKey, password } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey obrigatória' });
    await updateKeyPassword(apiKey, password || '');
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/', async (req, res) => {
  try {
    const { k, p, q, c } = req.body;
    if (!k) return res.status(401).json({ error: 'Chave (k) obrigatória' });
    const keyData = await validateKey(k, p || '');
    if (!checkRateLimit(keyData)) return res.status(429).json({ error: 'Limite excedido' });
    const question = (q || '').toString().trim();
    if (!question) return res.status(400).json({ error: 'q obrigatório' });
    const maxTok = Math.min(parseInt(c?.maxTokens) || 80, 120);
    const result = nilou.generateUntilEnd(question, maxTok);
    recordKeyUsage(keyData, result.tokens);
    res.json({ r: result.text, t: result.tokens });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/admin/keys', async (req, res) => {
  try {
    const list = await db('list', 'nilou_keys');
    res.json(list?.data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const list = await db('list', 'nilou_users');
    res.json(list?.data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/delete-key', async (req, res) => {
  try {
    await deleteKey(req.body.apiKey);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/admin/delete-user', async (req, res) => {
  try {
    await deleteUser(req.body.email);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.listen(PORT, async () => {
  await ensureAdmin();
  console.log(`Nilou rodando na porta ${PORT}`);
  console.log('Admin: email=adm senha=130116');
});
