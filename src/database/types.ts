/**
 * Database Type Definitions
 * 
 * TypeScript interfaces for all SQLite database tables
 * These types match the schema defined in sqlite_schema.sql
 */

// =========================================================
// Base types for common fields
// =========================================================

export interface SyncableRecord {
  data_sync?: string | null;
  origem_offline?: number; // 0 = synchronized, 1 = created offline
}

export interface AuditableRecord {
  criado_por: string;
  atualizado_por: string;
}

// =========================================================
// Table Types
// =========================================================

/**
 * Material (Recyclable materials)
 */
export interface Material extends SyncableRecord, AuditableRecord {
  id?: number; // Auto-increment primary key
  data: string;
  nome: string;
  categoria: string;
  preco_compra: number;
  preco_venda: number;
}

/**
 * Vale False (Vouchers/IOUs)
 */
export interface ValeFalse extends SyncableRecord, AuditableRecord {
  id?: number;
  data: string;
  status: number; // 0 = pending, other values TBD
  nome: string;
  valor: number;
  observacao?: string | null;
}

/**
 * Pendencia False (Pending transactions)
 */
export interface PendenciaFalse extends SyncableRecord, AuditableRecord {
  id?: number;
  data: string;
  status: number;
  nome: string;
  valor: number;
  tipo: string;
  observacao?: string | null;
}

/**
 * Comanda 20 (Last 20 orders/commands)
 */
export interface Comanda20 extends SyncableRecord {
  comanda_id?: number | null;
  comanda_data?: string | null;
  codigo?: string | null;
  comanda_tipo?: string | null;
  observacoes?: string | null;
  comanda_total?: number | null;
  item_id?: number | null;
  item_data?: string | null;
  material_id?: number | null;
  preco_kg?: number | null;
  kg_total?: number | null;
  item_valor_total?: number | null;
}

/**
 * Fechamento Mes (Monthly closing)
 */
export interface FechamentoMes extends SyncableRecord, AuditableRecord {
  id?: number;
  data?: string | null;
  compra?: number | null;
  despesa?: number | null;
  venda?: number | null;
  lucro?: number | null;
  observacao?: string | null;
}

/**
 * Relatorio Diario (Daily report)
 */
export interface RelatorioDiario {
  data?: string | null;
  compra?: number | null;
  venda?: number | null;
  despesa?: number | null;
  lucro?: number | null;
  data_sync?: string | null;
}

/**
 * Relatorio Mensal (Monthly report)
 */
export interface RelatorioMensal {
  referencia?: string | null; // e.g., "2025-01"
  compra?: number | null;
  venda?: number | null;
  despesa?: number | null;
  lucro?: number | null;
  data_sync?: string | null;
}

/**
 * Relatorio Anual (Annual report)
 */
export interface RelatorioAnual {
  referencia?: string | null; // e.g., "2025"
  compra?: number | null;
  venda?: number | null;
  despesa?: number | null;
  lucro?: number | null;
  data_sync?: string | null;
}

/**
 * Compra Por Material Diario (Daily purchases by material)
 */
export interface CompraPorMaterialDiario {
  nome?: string | null;
  data?: string | null;
  kg?: number | null;
  gasto?: number | null;
  data_sync?: string | null;
}

/**
 * Compra Por Material Mes (Monthly purchases by material)
 */
export interface CompraPorMaterialMes {
  nome?: string | null;
  referencia?: string | null;
  kg?: number | null;
  gasto?: number | null;
  data_sync?: string | null;
}

/**
 * Compra Por Material Anual (Annual purchases by material)
 */
export interface CompraPorMaterialAnual {
  nome?: string | null;
  referencia?: string | null;
  kg?: number | null;
  gasto?: number | null;
  data_sync?: string | null;
}

/**
 * Venda Por Material Diario (Daily sales by material)
 */
export interface VendaPorMaterialDiario {
  nome?: string | null;
  data?: string | null;
  kg?: number | null;
  gasto?: number | null; // Note: column name is 'gasto' but represents revenue
  data_sync?: string | null;
}

/**
 * Venda Por Material Mes (Monthly sales by material)
 */
export interface VendaPorMaterialMes {
  nome?: string | null;
  referencia?: string | null;
  kg?: number | null;
  gasto?: number | null;
  data_sync?: string | null;
}

/**
 * Venda Por Material Anual (Annual sales by material)
 */
export interface VendaPorMaterialAnual {
  nome?: string | null;
  referencia?: string | null;
  kg?: number | null;
  gasto?: number | null;
  data_sync?: string | null;
}

/**
 * Ultimas 20 (Last 20 transactions)
 */
export interface Ultimas20 extends SyncableRecord, AuditableRecord {
  id?: number;
  data?: string | null;
  material?: number | null;
  comanda?: number | null;
  preco_kg?: number | null;
  kg_total?: number | null;
  valor_total?: number | null;
}

/**
 * Estoque (Inventory/Stock)
 */
export interface Estoque {
  material?: string | null;
  kg_total?: number | null;
  valor_medio_kg?: number | null;
  valor_total_gasto?: number | null;
  data_sync?: string | null;
}

/**
 * Despesa Mes (Monthly expenses)
 */
export interface DespesaMes extends SyncableRecord, AuditableRecord {
  id?: number;
  data?: string | null;
  descricao?: string | null;
  valor?: number | null;
}

/**
 * Calculo Fechamento (Closing calculation)
 */
export interface CalculoFechamento {
  desde_data?: string | null;
  ate_data?: string | null;
  compra?: number | null;
  despesa?: number | null;
  venda?: number | null;
  lucro?: number | null;
  data_sync?: string | null;
}

/**
 * Sync Queue (Synchronization queue)
 */
export interface SyncQueue {
  id?: number;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id?: string | null;
  payload: string; // JSON string
  created_at?: string; // CURRENT_TIMESTAMP default
  synced?: number; // 0 = pending, 1 = synced
}

// =========================================================
// Helper Types
// =========================================================

/**
 * Table names as a union type for type safety
 */
export type TableName =
  | 'material'
  | 'vale_false'
  | 'pendencia_false'
  | 'comanda_20'
  | 'fechamento_mes'
  | 'relatorio_diario'
  | 'relatorio_mensal'
  | 'relatorio_anual'
  | 'compra_por_material_diario'
  | 'compra_por_material_mes'
  | 'compra_por_material_anual'
  | 'venda_por_material_diario'
  | 'venda_por_material_mes'
  | 'venda_por_material_anual'
  | 'ultimas_20'
  | 'estoque'
  | 'despesa_mes'
  | 'calculo_fechamento'
  | 'sync_queue';

/**
 * Map table names to their corresponding types
 */
export interface TableTypeMap {
  material: Material;
  vale_false: ValeFalse;
  pendencia_false: PendenciaFalse;
  comanda_20: Comanda20;
  fechamento_mes: FechamentoMes;
  relatorio_diario: RelatorioDiario;
  relatorio_mensal: RelatorioMensal;
  relatorio_anual: RelatorioAnual;
  compra_por_material_diario: CompraPorMaterialDiario;
  compra_por_material_mes: CompraPorMaterialMes;
  compra_por_material_anual: CompraPorMaterialAnual;
  venda_por_material_diario: VendaPorMaterialDiario;
  venda_por_material_mes: VendaPorMaterialMes;
  venda_por_material_anual: VendaPorMaterialAnual;
  ultimas_20: Ultimas20;
  estoque: Estoque;
  despesa_mes: DespesaMes;
  calculo_fechamento: CalculoFechamento;
  sync_queue: SyncQueue;
}

/**
 * Generic type for getting table type from table name
 */
export type TableType<T extends TableName> = TableTypeMap[T];
