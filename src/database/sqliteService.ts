/**
 * SQLite Database Service
 * 
 * This service provides a clean API for database operations throughout the app.
 * It wraps the Capacitor SQLite connection with convenient methods for common operations.
 */

import { SQLiteDBConnection, capSQLiteChanges } from '@capacitor-community/sqlite';
import { getDatabase, initializeDatabase, isDatabaseInitialized } from './initDatabase';
import { logger } from '@/utils/logger';

/**
 * Ensure database is initialized before operations
 */
async function ensureInitialized(): Promise<SQLiteDBConnection> {
  if (!isDatabaseInitialized()) {
    logger.warn('Database not initialized, initializing now...');
    return await initializeDatabase();
  }
  return getDatabase();
}

/**
 * Execute a SELECT query and return results
 */
export async function executeQuery<T = any>(
  query: string,
  values?: any[]
): Promise<T[]> {
  try {
    const db = await ensureInitialized();
    
    logger.info('📋 Executing query:', query);
    if (values) {
      logger.info('   With values:', values);
    }

    const result = await db.query(query, values);
    const rows = result.values || [];
    
    logger.info(`✅ Query returned ${rows.length} rows`);
    return rows as T[];
  } catch (error) {
    logger.error('❌ Query execution failed:', error);
    logger.error('   Query:', query);
    throw error;
  }
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement
 */
export async function executeStatement(
  statement: string,
  values?: any[]
): Promise<capSQLiteChanges> {
  try {
    const db = await ensureInitialized();
    
    logger.info('✏️ Executing statement:', statement);
    if (values) {
      logger.info('   With values:', values);
    }

    const result = await db.run(statement, values);
    
    logger.info(`✅ Statement executed. Changes: ${result.changes?.changes || 0}, Last ID: ${result.changes?.lastId || 'N/A'}`);
    return result.changes || { changes: 0 };
  } catch (error) {
    logger.error('❌ Statement execution failed:', error);
    logger.error('   Statement:', statement);
    throw error;
  }
}

/**
 * Execute multiple statements in a transaction
 */
export async function executeTransaction(
  statements: Array<{ statement: string; values?: any[] }>
): Promise<void> {
  try {
    const db = await ensureInitialized();
    
    logger.info(`🔄 Starting transaction with ${statements.length} statements...`);

    await db.execute('BEGIN TRANSACTION;');
    
    try {
      for (let i = 0; i < statements.length; i++) {
        const { statement, values } = statements[i];
        logger.info(`   [${i + 1}/${statements.length}] Executing:`, statement);
        await db.run(statement, values);
      }
      
      await db.execute('COMMIT;');
      logger.info('✅ Transaction committed successfully');
    } catch (error) {
      await db.execute('ROLLBACK;');
      logger.error('❌ Transaction rolled back due to error');
      throw error;
    }
  } catch (error) {
    logger.error('❌ Transaction failed:', error);
    throw error;
  }
}

/**
 * Insert a record into a table
 */
export async function insert(
  table: string,
  data: Record<string, any>
): Promise<number> {
  try {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);

    const statement = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    const result = await executeStatement(statement, values);
    const lastId = result.lastId || 0;
    
    logger.info(`✅ Inserted record into '${table}' with ID: ${lastId}`);
    return lastId;
  } catch (error) {
    logger.error(`❌ Failed to insert into '${table}':`, error);
    throw error;
  }
}

/**
 * Update records in a table
 */
export async function update(
  table: string,
  data: Record<string, any>,
  where: string,
  whereValues?: any[]
): Promise<number> {
  try {
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(data), ...(whereValues || [])];

    const statement = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${where}
    `;

    const result = await executeStatement(statement, values);
    const changes = result.changes || 0;
    
    logger.info(`✅ Updated ${changes} record(s) in '${table}'`);
    return changes;
  } catch (error) {
    logger.error(`❌ Failed to update '${table}':`, error);
    throw error;
  }
}

/**
 * Delete records from a table
 */
export async function deleteFrom(
  table: string,
  where: string,
  whereValues?: any[]
): Promise<number> {
  try {
    const statement = `DELETE FROM ${table} WHERE ${where}`;
    
    const result = await executeStatement(statement, whereValues);
    const changes = result.changes || 0;
    
    logger.info(`✅ Deleted ${changes} record(s) from '${table}'`);
    return changes;
  } catch (error) {
    logger.error(`❌ Failed to delete from '${table}':`, error);
    throw error;
  }
}

/**
 * Select all records from a table
 */
export async function selectAll<T = any>(
  table: string,
  orderBy?: string
): Promise<T[]> {
  try {
    const orderClause = orderBy ? ` ORDER BY ${orderBy}` : '';
    const query = `SELECT * FROM ${table}${orderClause}`;
    
    return await executeQuery<T>(query);
  } catch (error) {
    logger.error(`❌ Failed to select from '${table}':`, error);
    throw error;
  }
}

/**
 * Select records with a WHERE clause
 */
export async function selectWhere<T = any>(
  table: string,
  where: string,
  whereValues?: any[],
  orderBy?: string
): Promise<T[]> {
  try {
    const orderClause = orderBy ? ` ORDER BY ${orderBy}` : '';
    const query = `SELECT * FROM ${table} WHERE ${where}${orderClause}`;
    
    return await executeQuery<T>(query, whereValues);
  } catch (error) {
    logger.error(`❌ Failed to select from '${table}':`, error);
    throw error;
  }
}

/**
 * Get a single record by ID
 */
export async function selectById<T = any>(
  table: string,
  id: number | string
): Promise<T | null> {
  try {
    const results = await selectWhere<T>(table, 'id = ?', [id]);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    logger.error(`❌ Failed to select by ID from '${table}':`, error);
    throw error;
  }
}

/**
 * Count records in a table
 */
export async function count(
  table: string,
  where?: string,
  whereValues?: any[]
): Promise<number> {
  try {
    const whereClause = where ? ` WHERE ${where}` : '';
    const query = `SELECT COUNT(*) as count FROM ${table}${whereClause}`;
    
    const results = await executeQuery<{ count: number }>(query, whereValues);
    return results[0]?.count || 0;
  } catch (error) {
    logger.error(`❌ Failed to count records in '${table}':`, error);
    throw error;
  }
}

/**
 * Check if a record exists
 */
export async function exists(
  table: string,
  where: string,
  whereValues?: any[]
): Promise<boolean> {
  try {
    const countResult = await count(table, where, whereValues);
    return countResult > 0;
  } catch (error) {
    logger.error(`❌ Failed to check existence in '${table}':`, error);
    throw error;
  }
}

/**
 * Clear all records from a table
 */
export async function clearTable(table: string): Promise<number> {
  try {
    const statement = `DELETE FROM ${table}`;
    const result = await executeStatement(statement);
    const changes = result.changes || 0;
    
    logger.info(`✅ Cleared ${changes} record(s) from '${table}'`);
    return changes;
  } catch (error) {
    logger.error(`❌ Failed to clear table '${table}':`, error);
    throw error;
  }
}

/**
 * Add a record to the sync queue for later synchronization
 */
export async function addToSyncQueue(
  tableName: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string | number,
  payload: Record<string, any>
): Promise<number> {
  try {
    return await insert('sync_queue', {
      table_name: tableName,
      operation,
      record_id: String(recordId),
      payload: JSON.stringify(payload),
      synced: 0
    });
  } catch (error) {
    logger.error('❌ Failed to add to sync queue:', error);
    throw error;
  }
}

/**
 * Get all pending sync queue items
 */
export async function getPendingSyncItems(): Promise<any[]> {
  try {
    return await selectWhere('sync_queue', 'synced = ?', [0], 'created_at ASC');
  } catch (error) {
    logger.error('❌ Failed to get pending sync items:', error);
    throw error;
  }
}

/**
 * Mark sync queue item as synced
 */
export async function markSyncItemAsSynced(syncId: number): Promise<void> {
  try {
    await update('sync_queue', { synced: 1 }, 'id = ?', [syncId]);
    logger.info(`✅ Marked sync item ${syncId} as synced`);
  } catch (error) {
    logger.error('❌ Failed to mark sync item as synced:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<Record<string, number>> {
  try {
    const tables = [
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
      'sync_queue'
    ];

    const stats: Record<string, number> = {};

    for (const table of tables) {
      stats[table] = await count(table);
    }

    logger.info('📊 Database statistics:', stats);
    return stats;
  } catch (error) {
    logger.error('❌ Failed to get database stats:', error);
    throw error;
  }
}

// Export a default object with all methods for convenience
export default {
  executeQuery,
  executeStatement,
  executeTransaction,
  insert,
  update,
  deleteFrom,
  selectAll,
  selectWhere,
  selectById,
  count,
  exists,
  clearTable,
  addToSyncQueue,
  getPendingSyncItems,
  markSyncItemAsSynced,
  getDatabaseStats
};
