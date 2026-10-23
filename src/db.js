/**
 * Cliente DB para Nilou
 * Token vem do ambiente ou da linha de comando (mais seguro)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mfwqqkzlqlklnrgabvvx.supabase.co';

let sb = null;

export function initDb(token) {
  const key = token || process.env.SUPABASE_KEY || process.argv[2];
  if (!key) {
    console.warn('[DB] Nenhum token fornecido. Persistência desativada.');
    return;
  }
  sb = createClient(SUPABASE_URL, key);
  console.log('[DB] Conectado com token fornecido');
}

export async function db(action, table, key = null, value = null) {
  if (!sb) throw new Error('DB não inicializado. Passe o token na linha de comando.');

  const { data, error } = await sb.functions.invoke('DB', {
    body: { action, table, key, value }
  });

  if (error) {
    let detalhes = '';
    try {
      if (error.context) detalhes = await error.context.text();
    } catch {}
    throw new Error(error.message + (detalhes ? ' | ' + detalhes : ''));
  }

  if (data?.error) throw new Error(data.error);
  return data;
}
