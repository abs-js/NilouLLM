/**
 * Nilou Auth + API Keys
 */
import crypto from 'crypto';
import { db } from './db.js';

const ADMIN_NICK = 'abs-js';
const ADMIN_USER = 'adm';
const ADMIN_PASS = '130116';

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function generateKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return 'NilouKey-' + result;
}

function generateCode() {
  const n = () => Math.floor(1000 + Math.random() * 9000);
  return `${n()}-${n()}`;
}

export async function registerUser(nickname, email, password) {
  const key = `nilouUser_${email.toLowerCase()}`;
  const existing = await db('get', 'nilou_users', key).catch(() => null);
  if (existing?.value) throw new Error('E-mail já cadastrado');
  const code = generateCode();
  const user = {
    nickname, email: email.toLowerCase(), passwordHash: hash(password),
    verified: false, verifyCode: code, isAdmin: nickname === ADMIN_NICK,
    createdAt: new Date().toISOString(), keys: []
  };
  await db('set', 'nilou_users', key, user);
  return { email: user.email, verifyCode: code };
}

export async function verifyUser(email, code) {
  const key = `nilouUser_${email.toLowerCase()}`;
  const res = await db('get', 'nilou_users', key);
  const user = res?.value;
  if (!user) throw new Error('Usuário não encontrado');
  if (user.verified) return true;
  if (user.verifyCode !== code) throw new Error('Código inválido');
  user.verified = true;
  delete user.verifyCode;
  await db('set', 'nilou_users', key, user);
  return true;
}

export async function login(email, password) {
  const key = `nilouUser_${email.toLowerCase()}`;
  const res = await db('get', 'nilou_users', key);
  const user = res?.value;
  if (!user || user.passwordHash !== hash(password)) throw new Error('Credenciais inválidas');
  if (!user.verified) throw new Error('Conta não verificada');
  return { email: user.email, nickname: user.nickname, isAdmin: !!user.isAdmin };
}

export async function createApiKey(email, name, model = 'Nilou 0.0.0', keyPassword = '') {
  const userKey = `nilouUser_${email.toLowerCase()}`;
  const res = await db('get', 'nilou_users', userKey);
  const user = res?.value;
  if (!user) throw new Error('Usuário não encontrado');
  const isAdmin = user.isAdmin || user.nickname === ADMIN_NICK;
  if (!isAdmin && (user.keys || []).length >= 1) throw new Error('Usuários normais só podem ter 1 chave');
  const apiKey = generateKey();
  const keyData = {
    key: apiKey, name, model,
    passwordHash: keyPassword ? hash(keyPassword) : null,
    owner: email.toLowerCase(), createdAt: new Date().toISOString(),
    limits: isAdmin ? null : { reqPerMin: 2, tokensPerMin: 200, dailyReq: 40, monthlyReq: 600 },
    usage: { requests: 0, tokens: 0 }
  };
  await db('set', 'nilou_keys', `niloukey__${apiKey}`, keyData);
  user.keys = user.keys || [];
  user.keys.push({ key: apiKey, name, model });
  await db('set', 'nilou_users', userKey, user);
  return { apiKey, name, model };
}

export async function updateKeyPassword(apiKey, newPassword) {
  const res = await db('get', 'nilou_keys', `niloukey__${apiKey}`);
  const keyData = res?.value;
  if (!keyData) throw new Error('Chave não encontrada');
  keyData.passwordHash = newPassword ? hash(newPassword) : null;
  await db('set', 'nilou_keys', `niloukey__${apiKey}`, keyData);
  return true;
}

export function getLimits(keyData) {
  if (!keyData.limits) return { unlimited: true };
  return keyData.limits;
}

export async function deleteKey(apiKey) {
  await db('delete', 'nilou_keys', `niloukey__${apiKey}`);
  return true;
}

export async function deleteUser(email) {
  await db('delete', 'nilou_users', `nilouUser_${email.toLowerCase()}`);
  return true;
}

export async function validateKey(apiKey, password = '') {
  const res = await db('get', 'nilou_keys', `niloukey__${apiKey}`);
  const keyData = res?.value;
  if (!keyData) throw new Error('Chave inválida');
  if (keyData.passwordHash && hash(password) !== keyData.passwordHash) throw new Error('Senha da chave incorreta');
  return keyData;
}

export async function ensureAdmin() {
  try {
    const key = `nilouUser_${ADMIN_USER}`;
    const res = await db('get', 'nilou_users', key).catch(() => null);
    if (!res?.value) {
      await db('set', 'nilou_users', key, {
        nickname: ADMIN_NICK, email: ADMIN_USER, passwordHash: hash(ADMIN_PASS),
        verified: true, isAdmin: true, createdAt: new Date().toISOString(), keys: []
      });
    }
  } catch (e) {}
}
