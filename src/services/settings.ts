import { logger } from '@/utils/logger';

export interface SupabaseSettings {
  url: string;
  anonKey: string;
}

const SUPABASE_URL_KEY = 'supabase.url';
const SUPABASE_ANON_KEY = 'supabase.anonKey';
const LAST_SYNC_AT_KEY = 'sync.lastSyncAt';
const COMANDA_PREFIX_KEY = 'comanda.prefix';
const COMANDA_COUNTER_PREFIX = 'comanda.counter.'; // + <prefix>

export function getSupabaseSettings(): SupabaseSettings | null {
  try {
    const url = localStorage.getItem(SUPABASE_URL_KEY) || '';
    const anonKey = localStorage.getItem(SUPABASE_ANON_KEY) || '';
    if (!url || !anonKey) return null;
    return { url, anonKey };
  } catch (error) {
    logger.error('Failed to read Supabase settings:', error);
    return null;
  }
}

export function saveSupabaseSettings(settings: SupabaseSettings) {
  try {
    localStorage.setItem(SUPABASE_URL_KEY, settings.url.trim());
    localStorage.setItem(SUPABASE_ANON_KEY, settings.anonKey.trim());
    logger.info('Supabase settings saved');
  } catch (error) {
    logger.error('Failed to save Supabase settings:', error);
    throw error;
  }
}

export function getLastSyncAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_AT_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncAt(isoDate: string) {
  try {
    localStorage.setItem(LAST_SYNC_AT_KEY, isoDate);
  } catch (error) {
    logger.warn('Failed to set last sync at', error);
  }
}

export function clearSupabaseSettings() {
  try {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_ANON_KEY);
  } catch (error) {
    logger.warn('Failed to clear Supabase settings', error);
  }
}

export function getComandaPrefix(): string {
  try {
    return localStorage.getItem(COMANDA_PREFIX_KEY) || '';
  } catch {
    return '';
  }
}

export function setComandaPrefix(prefix: string) {
  try {
    const normalized = (prefix || '').trim().toUpperCase();
    localStorage.setItem(COMANDA_PREFIX_KEY, normalized);
  } catch (error) {
    logger.warn('Failed to save comanda prefix', error);
    throw error;
  }
}

export function peekComandaSequence(prefix: string): number {
  try {
    const key = COMANDA_COUNTER_PREFIX + (prefix || '');
    const raw = localStorage.getItem(key);
    const n = raw ? parseInt(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function nextComandaSequence(prefix: string): number {
  const key = COMANDA_COUNTER_PREFIX + (prefix || '');
  try {
    const current = peekComandaSequence(prefix);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch (error) {
    logger.warn('Failed to increment comanda sequence', error);
    // Fallback: try to set to 1
    try { localStorage.setItem(key, '1'); } catch {}
    return 1;
  }
}

export function buildComandaCodigo(prefix: string, sequence: number): string {
  const p = (prefix || '').trim();
  if (!p) return String(sequence);
  return `${p}-${sequence}`;
}

