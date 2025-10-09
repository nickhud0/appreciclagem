import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseSettings } from './settings';
import { logger } from '@/utils/logger';

let cachedClient: SupabaseClient | null = null;
let cachedKey: string | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const settings = getSupabaseSettings();
  if (!settings) {
    logger.warn('Supabase settings not configured');
    cachedClient = null;
    cachedKey = null;
    return null;
  }

  const key = `${settings.url}|${settings.anonKey}`;
  if (cachedClient && cachedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(settings.url, settings.anonKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'reciclagem-app' } },
    });
    cachedKey = key;
    logger.info('Supabase client created');
    return cachedClient;
  } catch (error) {
    logger.error('Failed to create Supabase client:', error);
    cachedClient = null;
    cachedKey = null;
    return null;
  }
}

export function resetSupabaseClient() {
  cachedClient = null;
  cachedKey = null;
}

