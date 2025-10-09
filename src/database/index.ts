/**
 * Database Module Exports
 * 
 * Central export point for all database-related functionality
 */

// Database initialization
export {
  initializeDatabase,
  getDatabase,
  getSQLiteConnection,
  closeDatabase,
  isDatabaseInitialized,
  DB_CONFIG
} from './initDatabase';

// Database service methods
export {
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
} from './sqliteService';

// Database types
export type {
  Material,
  ValeFalse,
  PendenciaFalse,
  Comanda20,
  FechamentoMes,
  RelatorioDiario,
  RelatorioMensal,
  RelatorioAnual,
  CompraPorMaterialDiario,
  CompraPorMaterialMes,
  CompraPorMaterialAnual,
  VendaPorMaterialDiario,
  VendaPorMaterialMes,
  VendaPorMaterialAnual,
  Ultimas20,
  Estoque,
  DespesaMes,
  CalculoFechamento,
  SyncQueue,
  TableName,
  TableTypeMap,
  TableType,
  SyncableRecord,
  AuditableRecord
} from './types';

// Re-export the default service object
export { default as dbService } from './sqliteService';
