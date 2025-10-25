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
  update,
  deleteFrom
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
  'calculo_fechamento',
  // View synced into local table with single-row replace
  'resumo_estoque_financeiro'
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

    // Local-only entries: do not push to Supabase; mark and remove from queue
    if (table === 'ultimas_20') {
      try {
        await markSyncItemAsSynced(item.id);
      } catch (e) {
        logger.warn('Could not mark local-only item as synced, id=' + item.id, e);
      }
      try {
        await deleteFrom('sync_queue', 'id = ?', [item.id]);
      } catch (e) {
        logger.warn('Could not delete local-only item from sync_queue id=' + item.id, e);
      }
      continue;
    }

    try {
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

          ({ data, error } = await client
            .from('material')
            .upsert(remote, { onConflict: 'id' })
            .select());
        } else if (table === 'comanda') {
          // Map and sanitize payload for Supabase 'comanda' table
          // Use upsert on unique codigo to avoid duplicate-code errors keeping the item in queue
          const remote: Record<string, any> = {};
          if (payload.id != null) remote.id = payload.id;
          if (payload.data != null) remote.data = payload.data;
          if (payload.codigo != null) remote.codigo = String(payload.codigo);
          if (payload.tipo != null) remote.tipo = String(payload.tipo).toLowerCase();
          if (payload.observacoes != null) remote.observacoes = payload.observacoes;
          if (payload.total != null) remote.total = Number(payload.total) || 0;
          if (payload.criado_por != null) remote.criado_por = payload.criado_por;
          if (payload.atualizado_por != null) remote.atualizado_por = payload.atualizado_por;

          ({ data, error } = await client
            .from('comanda')
            .upsert(remote, { onConflict: 'codigo' })
            .select());
        } else if (table === 'item') {
          // Map and sanitize payload for Supabase 'item' table
          const remote: Record<string, any> = {};
          if (payload.id != null) remote.id = payload.id;
          if (payload.data != null) remote.data = payload.data;

          // Resolve comanda id (prefer numeric id, else lookup by codigo)
          let comandaId: number | null = null;
          try {
            const rawComanda = payload.comanda ?? payload.comanda_id ?? null;
            if (rawComanda != null && String(rawComanda).trim() !== '' && !Number.isNaN(Number(rawComanda))) {
              comandaId = Number(rawComanda);
            } else if (payload.codigo) {
              const codigo = String(payload.codigo);
              const resp = await client
                .from('comanda')
                .select('id')
                .eq('codigo', codigo)
                .limit(1);
              if (!resp.error && Array.isArray(resp.data) && resp.data.length > 0) {
                comandaId = Number(resp.data[0].id);
              }
            }
          } catch {}

          // Resolve material id (prefer numeric id, else lookup by name)
          let materialId: number | null = null;
          try {
            const rawMaterial = payload.material ?? payload.material_id ?? payload.materialId ?? null;
            if (rawMaterial != null && String(rawMaterial).trim() !== '' && !Number.isNaN(Number(rawMaterial))) {
              materialId = Number(rawMaterial);
            } else if (payload.material_nome) {
              const nome = String(payload.material_nome);
              const resp = await client
                .from('material')
                .select('id')
                .eq('nome', nome)
                .limit(1);
              if (!resp.error && Array.isArray(resp.data) && resp.data.length > 0) {
                materialId = Number(resp.data[0].id);
              }
            }
          } catch {}

          // If we cannot resolve FKs yet, skip for now (keep in queue)
          if (!comandaId || !materialId) {
            logger.info('Deferred item push awaiting FK resolution', { comandaId, materialId, payload });
            continue;
          }

          remote.comanda = comandaId;
          remote.material = materialId;
          remote.preco_kg = Number(payload.preco_kg ?? payload.preco ?? 0) || 0;
          remote.kg_total = Number(payload.kg_total ?? payload.quantidade ?? payload.kg ?? 0) || 0;
          remote.valor_total = Number(
            payload.valor_total ?? payload.total ?? (Number(remote.preco_kg) * Number(remote.kg_total))
          ) || 0;
          remote.criado_por = payload.criado_por ?? 'local-user';
          remote.atualizado_por = payload.atualizado_por ?? 'local-user';

          if (op === 'INSERT') {
            ({ data, error } = await client
              .from('item')
              .insert(remote)
              .select());
          } else {
            ({ data, error } = await client
              .from('item')
              .upsert(remote, { onConflict: 'id' })
              .select());
          }
        } else if (table === 'despesa') {
          // Sanitize and map payload for Supabase 'despesa' table
          const remote: Record<string, any> = {};
          if (payload.id != null) remote.id = payload.id;
          if (payload.data != null) remote.data = payload.data;
          if (payload.descricao != null) remote.descricao = payload.descricao;
          if (payload.valor != null) remote.valor = Number(payload.valor) || 0;
          if (payload.criado_por != null) remote.criado_por = payload.criado_por;
          if (payload.atualizado_por != null) remote.atualizado_por = payload.atualizado_por;

          if (op === 'INSERT') {
            ({ data, error } = await client
              .from('despesa')
              .insert(remote)
              .select());
          } else {
            ({ data, error } = await client
              .from('despesa')
              .upsert(remote, { onConflict: 'id' })
              .select());
          }
        } else if (table === 'vale_false') {
          // Map vale_false (local view of pendentes) to Supabase 'vale'
          const remote: Record<string, any> = {};
          if (payload.id != null) remote.id = payload.id;
          if (payload.data != null) remote.data = payload.data;
          // Local uses 0/1; Supabase expects boolean
          if (payload.status != null) remote.status = !!payload.status;
          if (payload.nome != null) remote.nome = payload.nome;
          if (payload.valor != null) remote.valor = Number(payload.valor) || 0;
          if (payload.observacao != null) remote.observacao = payload.observacao;
          if (payload.criado_por != null) remote.criado_por = payload.criado_por;
          if (payload.atualizado_por != null) remote.atualizado_por = payload.atualizado_por;

          if (op === 'INSERT') {
            ({ data, error } = await client
              .from('vale')
              .insert(remote)
              .select());
          } else {
            ({ data, error } = await client
              .from('vale')
              .upsert(remote, { onConflict: 'id' })
              .select());
          }
        } else if (table === 'pendencia_false') {
          // Map pendencia_false (local pending view) to Supabase 'pendencia'
          const remote: Record<string, any> = {};
          if (payload.id != null) remote.id = payload.id;
          if (payload.data != null) remote.data = payload.data;
          if (payload.status != null) remote.status = !!payload.status;
          if (payload.nome != null) remote.nome = payload.nome;
          if (payload.valor != null) remote.valor = Number(payload.valor) || 0;
          if (payload.tipo != null) remote.tipo = payload.tipo; // enum pendencia_tipo
          if (payload.observacao != null) remote.observacao = payload.observacao;
          if (payload.criado_por != null) remote.criado_por = payload.criado_por;
          if (payload.atualizado_por != null) remote.atualizado_por = payload.atualizado_por;

          if (op === 'INSERT') {
            ({ data, error } = await client
              .from('pendencia')
              .insert(remote)
              .select());
          } else {
            ({ data, error } = await client
              .from('pendencia')
              .upsert(remote, { onConflict: 'id' })
              .select());
          }
        } else {
          ({ data, error } = await client
            .from(table)
            .upsert(payload)
            .select());
        }

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
        try {
          await deleteFrom('sync_queue', 'id = ?', [item.id]);
        } catch (e) {
          // Non-fatal: if delete fails, item stays marked as synced
          logger.warn('Could not delete synced item from sync_queue id=' + item.id, e);
        }
      } else if (op === 'DELETE') {
        if (!recordId) {
          // cannot delete without id
          logger.warn('DELETE without record_id in sync_queue id=' + item.id);
          continue;
        }
        const { error } = await client.from(table).delete().eq('id', recordId);
        if (error) throw error;
        await markSyncItemAsSynced(item.id);
        try {
          await deleteFrom('sync_queue', 'id = ?', [item.id]);
        } catch (e) {
          logger.warn('Could not delete synced item from sync_queue id=' + item.id, e);
        }
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
      if (table === 'resumo_estoque_financeiro') {
        // Ensure table exists on previously-initialized databases
        await executeStatement(`
          CREATE TABLE IF NOT EXISTS resumo_estoque_financeiro (
            total_kg REAL,
            total_custo REAL,
            total_venda_potencial REAL,
            lucro_potencial REAL,
            updated_at TEXT
          )
        `);
        const { data, error } = await client.from('resumo_estoque_financeiro').select('*');
        if (error) throw error;
        const now = new Date().toISOString();
        const rows = Array.isArray(data) ? data : [];
        // Ensure single-row replace; if API returns empty, keep table cleared
        const normalized = rows.length > 0
          ? [{
              total_kg: Number(rows[0]?.total_kg ?? 0) || 0,
              total_custo: Number(rows[0]?.total_custo ?? 0) || 0,
              total_venda_potencial: Number(rows[0]?.total_venda_potencial ?? 0) || 0,
              lucro_potencial: Number(rows[0]?.lucro_potencial ?? 0) || 0,
              updated_at: now
            }]
          : [];
        await replaceTableData('resumo_estoque_financeiro', normalized);
      } else {
        const { data, error } = await client.from(table).select('*');
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        await replaceTableData(table, rows);
      }
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

