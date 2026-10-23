/**
 * Cliente DB para Nilou - usa Supabase Edge Function "DB"
 * Prefixo de chaves: Nilou000_
 */

import { createClient } from '@supabase/supabase-js';
import { KEY } from '../server.js';

const SUPABASE_URL = 'https://mfwqqkzlqlklnrgabvvx.supabase.co';
const SUPABASE_KEY = ;

const sb = createClient(SUPABASE_URL, KEY);

export async function db(action, table, key = null, value = null) {
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
