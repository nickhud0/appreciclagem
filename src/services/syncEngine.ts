import { Network } from '@capacitor/network';
import { logger } from '@/utils/logger';
import { getSupabaseClient } from './supabaseClient';
import { getSupabaseSettings, getLastSyncAt, setLastSyncAt } from './settings';
import {
  getPendingSyncItems,
  markSyncItemAsSynced,
  executeTransaction,
  executeStatement,
  insert,
  update
} from '@/database';

type Listener = (status: SyncStatus) => void;

export interface SyncStatus {
  isOnline: boolean;
  hasCredentials: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  lastError?: string | null;
}

const DEFAULT_INTERVAL_MS = 30_000;

// Views/tables to pull from Supabase → SQLite
const PULL_TABLES: string[] = [
  'material',
  'vale_false',
  'pendencia_false',
  'comanda_20',
  'fechamento_mes',
  'relatorio_diario',
  'relatorio_mensal',
  'relatorio_anual',
  'compra_por_material_diario',
  'compra_por_material_mes',
  'compra_por_material_anual',
  'venda_por_material_diario',
  'venda_por_material_mes',
  'venda_por_material_anual',
  'ultimas_20',
  'estoque',
  'despesa_mes',
  'calculo_fechamento'
];

let listeners: Listener[] = [];
let status: SyncStatus = {
  isOnline: false,
  hasCredentials: false,
  syncing: false,
  lastSyncAt: getLastSyncAt(),
  pendingCount: 0,
  lastError: null
};

let intervalId: number | null = null;
let networkListenerCleanup: (() => void) | null = null;

function emit() {
  for (const l of listeners) {
    try {
      l({ ...status });
    } catch (err) {
      // Ignore listener errors
    }
  }
}

async function refreshOnlineStatus() {
  try {
    const network = await Network.getStatus();
    status.isOnline = !!network.connected;
  } catch (error) {
    // default to navigator if available
    status.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
  }
}

function refreshCredentialsStatus() {
  status.hasCredentials = !!getSupabaseSettings();
}

async function pushPending(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn('Push skipped: Supabase client not configured');
    return;
  }

  const pending = await getPendingSyncItems();
  status.pendingCount = pending.length;
  emit();

  for (const item of pending) {
    const table = item.table_name as string;
    const op = (item.operation as string || '').toUpperCase();
    const recordId = item.record_id;
    let payload: any = null;
    try {
      payload = JSON.parse(item.payload);
    } catch (e) {
      logger.error('Invalid JSON payload in sync_queue id=' + item.id);
      continue;
    }

    try {
      if (op === 'INSERT' || op === 'UPDATE') {
        const { data, error } = await client
          .from(table)
          .upsert(payload)
          .select();
        if (error) throw error;

        // Mark local record as synced when applicable
        if (recordId && table && (op === 'INSERT' || op === 'UPDATE')) {
          try {
            const now = new Date().toISOString();
            await update(table, { origem_offline: 0, data_sync: now }, 'id = ?', [recordId]);
          } catch (e) {
            // Non-fatal if local update fails
            logger.warn('Could not update local record as synced for', table, recordId, e);
          }
        }

        await markSyncItemAsSynced(item.id);
      } else if (op === 'DELETE') {
        if (!recordId) {
          // cannot delete without id
          logger.warn('DELETE without record_id in sync_queue id=' + item.id);
          continue;
        }
        const { error } = await client.from(table).delete().eq('id', recordId);
        if (error) throw error;
        await markSyncItemAsSynced(item.id);
      } else {
        logger.warn('Unknown operation in sync_queue:', op);
        // skip unknown operations but don't mark as synced
      }
    } catch (err) {
      logger.error('Push failed for', table, 'op', op, err);
      // Stop processing further to avoid hammering; leave remaining in queue
      // Alternatively, continue to try others; we choose continue
      continue;
    }
  }
}

async function replaceTableData(table: string, rows: any[]): Promise<void> {
  // Build transaction: clear table, insert rows
  const stmts: Array<{ statement: string; values?: any[] }> = [];
  stmts.push({ statement: `DELETE FROM ${table}` });

  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((c) => row[c]);
    const statement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    stmts.push({ statement, values });
  }

  try {
    await executeTransaction(stmts);
  } catch (error) {
    // As a fallback, try to at least clear the table if inserts failed
    logger.error('Replace table data failed for', table, error);
    try {
      await executeStatement(`DELETE FROM ${table}`);
    } catch {}
    throw error;
  }
}

async function pullAll(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    logger.warn('Pull skipped: Supabase client not configured');
    return;
  }

  for (const table of PULL_TABLES) {
    try {
      const { data, error } = await client.from(table).select('*');
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      await replaceTableData(table, rows);
    } catch (error) {
      logger.error('Pull failed for table', table, error);
      // Continue with next table
    }
  }
}

async function syncOnce(): Promise<void> {
  // Refresh environment
  await refreshOnlineStatus();
  refreshCredentialsStatus();
  emit();

  if (!status.hasCredentials) {
    logger.warn('Sync idle: missing Supabase credentials');
    return;
  }
  if (!status.isOnline) {
    logger.info('Sync idle: offline');
    return;
  }

  status.syncing = true;
  status.lastError = null;
  emit();

  try {
    await pushPending();
    await pullAll();
    const now = new Date().toISOString();
    setLastSyncAt(now);
    status.lastSyncAt = now;
  } catch (error) {
    status.lastError = error instanceof Error ? error.message : String(error);
    logger.error('Sync cycle error:', error);
  } finally {
    status.syncing = false;
    emit();
  }
}

function ensureInterval(intervalMs: number) {
  if (intervalId !== null) return;
  // Use window.setInterval typing compatibility
  intervalId = window.setInterval(() => {
    void syncOnce();
  }, intervalMs) as unknown as number;
}

async function attachNetworkListener() {
  try {
    const listener = await Network.addListener('networkStatusChange', async (s) => {
      status.isOnline = !!s.connected;
      emit();
      if (status.isOnline && status.hasCredentials) {
        void syncOnce();
      }
    });
    networkListenerCleanup = () => listener.remove();
  } catch (error) {
    // On web, if plugin fails, rely on window events
    const onlineHandler = () => {
      status.isOnline = true;
      emit();
      if (status.hasCredentials) void syncOnce();
    };
    const offlineHandler = () => {
      status.isOnline = false;
      emit();
    };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    networkListenerCleanup = () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }
}

function attachStorageWatcher() {
  const handler = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key === 'supabase.url' || e.key === 'supabase.anonKey') {
      refreshCredentialsStatus();
      emit();
      if (status.hasCredentials && status.isOnline) {
        void syncOnce();
      }
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

let storageWatcherCleanup: (() => void) | null = null;

export function initializeSyncEngine(options?: { intervalMs?: number }) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  refreshCredentialsStatus();
  void refreshOnlineStatus();
  emit();

  ensureInterval(intervalMs);
  void attachNetworkListener();
  storageWatcherCleanup = attachStorageWatcher();
}

export function startSyncLoop() {
  // noop: interval is already ensured in initialize
  void syncOnce();
}

export function stopSyncLoop() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (networkListenerCleanup) {
    networkListenerCleanup();
    networkListenerCleanup = null;
  }
  if (storageWatcherCleanup) {
    storageWatcherCleanup();
    storageWatcherCleanup = null;
  }
}

export function triggerSyncNow() {
  void syncOnce();
}

export function onSyncStatus(listener: Listener) {
  listeners.push(listener);
  // Emit immediately with current status
  listener({ ...status });
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return { ...status };
}

// Allow pages to call after saving credentials locally
export function notifyCredentialsUpdated() {
  refreshCredentialsStatus();
  emit();
  if (status.hasCredentials && status.isOnline) {
    void syncOnce();
  }
}

