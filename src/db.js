import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mfwqqkzlqlklnrgabvvx.supabase.co';

// Argumento passado após server.js; variável de ambiente como alternativa.
const SUPABASE_KEY = process.argv[2] || process.env.SUPABASE_KEY;

const sb = SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export async function db(action, table, key = null, value = null) {
  if (!sb) {
    throw new Error('Chave do Supabase não configurada.');
  }

  const { data, error } = await sb.functions.invoke('DB', {
    body: { action, table, key, value }
  });

  if (error) {
    let details = '';

    try {
      if (error.context) {
        details = await error.context.text();
      }
    } catch {}

    throw new Error(
      error.message + (details ? ` | ${details}` : '')
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
