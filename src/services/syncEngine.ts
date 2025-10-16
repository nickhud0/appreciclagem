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

const DEFAULT_INTERVAL_MS = 30_000; // deprecated: no longer used for auto-sync

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

// Tables that contain an 'origem_offline' flag locally and must preserve
// offline-created rows during pulls to avoid data loss if push fails.
const PRESERVE_OFFLINE_ROWS_TABLES = new Set<string>([
  'material'
]);

let listeners: Listener[] = [];
let status: SyncStatus = {
  isOnline: false,
  hasCredentials: false,
  syncing: false,
  lastSyncAt: getLastSyncAt(),
  pendingCount: 0,
  lastError: null
};

let intervalId: number | null = null; // deprecated: we won't schedule intervals anymore
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
      logger.info('🔼 Pushing pending item', { id: item.id, table, op, recordId, keys: Object.keys(payload || {}) });
      if (op === 'INSERT' || op === 'UPDATE') {
        let data: any;
        let error: any;

        if (table === 'material') {
          // Sanitize payload to match Supabase 'material' columns only
          const remote: Record<string, any> = {};
          if (payload.id != null) remote.id = payload.id;
          if (payload.data != null) remote.data = payload.data;
          if (payload.nome != null) remote.nome = payload.nome;
          if (payload.categoria != null) remote.categoria = payload.categoria;
          if (payload.preco_compra != null) remote.preco_compra = Number(payload.preco_compra);
          if (payload.preco_venda != null) remote.preco_venda = Number(payload.preco_venda);
          if (payload.criado_por != null) remote.criado_por = payload.criado_por;
          if (payload.atualizado_por != null) remote.atualizado_por = payload.atualizado_por;

          logger.info('🧰 Material push sanitized payload', { keys: Object.keys(remote) });
          ({ data, error } = await client
            .from('material')
            .upsert(remote, { onConflict: 'id' })
            .select());
        } else {
          ({ data, error } = await client
            .from(table)
            .upsert(payload)
            .select());
        }

        if (error) throw error;
        logger.info('✅ Push success', { table, op, recordId, count: Array.isArray(data) ? data.length : 0 });

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
        logger.info('✅ Delete push success', { table, recordId });
        await markSyncItemAsSynced(item.id);
      } else {
        logger.warn('Unknown operation in sync_queue:', op);
        // skip unknown operations but don't mark as synced
      }
    } catch (err) {
      logger.error('❌ Push failed', { table, op, recordId, error: err });
      // Stop processing further to avoid hammering; leave remaining in queue
      // Alternatively, continue to try others; we choose continue
      continue;
    }
  }
}

async function replaceTableData(table: string, rows: any[]): Promise<void> {
  // Build transaction: clear table, insert rows
  const stmts: Array<{ statement: string; values?: any[] }> = [];
  const deleteStmt = PRESERVE_OFFLINE_ROWS_TABLES.has(table)
    ? `DELETE FROM ${table} WHERE origem_offline = 0`
    : `DELETE FROM ${table}`;
  stmts.push({ statement: deleteStmt });

  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((c) => row[c]);
    const insertVerb = PRESERVE_OFFLINE_ROWS_TABLES.has(table)
      ? 'INSERT OR IGNORE'
      : 'INSERT';
    const statement = `${insertVerb} INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    stmts.push({ statement, values });
  }

  try {
    await executeTransaction(stmts);
  } catch (error) {
    // As a fallback, try to at least clear the table if inserts failed
    logger.error('Replace table data failed for', table, error);
    // Do not clear the table to avoid data loss; keep existing local data intact
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

// Removed periodic auto-sync interval. Sync is now manual or at startup only.

async function attachNetworkListener() {
  try {
    const listener = await Network.addListener('networkStatusChange', async (s) => {
      status.isOnline = !!s.connected;
      emit();
      // No automatic sync on network changes
    });
    networkListenerCleanup = () => listener.remove();
  } catch (error) {
    // On web, if plugin fails, rely on window events
    const onlineHandler = () => {
      status.isOnline = true;
      emit();
      // No automatic sync on online
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
      // No automatic sync when credentials change; user will trigger manually
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

let storageWatcherCleanup: (() => void) | null = null;

export function initializeSyncEngine(options?: { intervalMs?: number }) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS; // kept for API compatibility
  refreshCredentialsStatus();
  void refreshOnlineStatus();
  emit();
  // No periodic interval is scheduled anymore
  void attachNetworkListener();
  storageWatcherCleanup = attachStorageWatcher();
}

export function startSyncLoop() {
  // Perform a single sync at startup if possible
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
  // Do not auto-sync on credentials changes; manual control only
}

