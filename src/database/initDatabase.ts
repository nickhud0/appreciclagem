/**
 * SQLite Database Initialization Module
 * 
 * This module handles the creation and initialization of the local SQLite database
 * for the offline-first app architecture. It reads the schema from sqlite_schema.sql
 * and creates all necessary tables on first app launch.
 * 
 * Database: reciclagem.db
 * Uses: @capacitor-community/sqlite v7
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/utils/logger';

// Database configuration
const DB_NAME = 'reciclagem.db';
const DB_VERSION = 1;
const DB_ENCRYPTED = false;
const DB_MODE = 'no-encryption';

// SQL Schema - imported from sqlite_schema.sql
const DATABASE_SCHEMA = `
BEGIN TRANSACTION;

-- =========================================================
--  Banco local do app (SQLite)
--  Espelhando o Supabase + colunas data_sync / origem_offline
-- =========================================================

-- ---------------------------------------------------------------------
-- 1) material
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  preco_compra REAL NOT NULL DEFAULT 0,
  preco_venda REAL NOT NULL DEFAULT 0,
  criado_por TEXT NOT NULL,
  atualizado_por TEXT NOT NULL,
  data_sync TEXT,                   -- última data de sincronização
  origem_offline INTEGER DEFAULT 0  -- 1 = criado offline, 0 = já sincronizado
);

-- ---------------------------------------------------------------------
-- 2) vale_false
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vale_false (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  nome TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_por TEXT NOT NULL,
  atualizado_por TEXT NOT NULL,
  data_sync TEXT,
  origem_offline INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 3) pendencia_false
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pendencia_false (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  nome TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL,
  observacao TEXT,
  criado_por TEXT NOT NULL,
  atualizado_por TEXT NOT NULL,
  data_sync TEXT,
  origem_offline INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 4) comanda_20
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comanda_20 (
  comanda_id INTEGER,
  comanda_data TEXT,
  codigo TEXT,
  comanda_tipo TEXT,
  observacoes TEXT,
  comanda_total REAL,
  item_id INTEGER,
  item_data TEXT,
  material_id INTEGER,
  preco_kg REAL,
  kg_total REAL,
  item_valor_total REAL,
  data_sync TEXT,
  origem_offline INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 5) fechamento_mes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fechamento_mes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT,
  compra REAL,
  despesa REAL,
  venda REAL,
  lucro REAL,
  observacao TEXT,
  criado_por TEXT,
  atualizado_por TEXT,
  data_sync TEXT,
  origem_offline INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 6) relatorio_diario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relatorio_diario (
  data TEXT,
  compra REAL,
  venda REAL,
  despesa REAL,
  lucro REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 7) relatorio_mensal
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relatorio_mensal (
  referencia TEXT,
  compra REAL,
  venda REAL,
  despesa REAL,
  lucro REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 8) relatorio_anual
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relatorio_anual (
  referencia TEXT,
  compra REAL,
  venda REAL,
  despesa REAL,
  lucro REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 9) compra_por_material_diario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compra_por_material_diario (
  nome TEXT,
  data TEXT,
  kg REAL,
  gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 10) compra_por_material_mes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compra_por_material_mes (
  nome TEXT,
  referencia TEXT,
  kg REAL,
  gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 11) compra_por_material_anual
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compra_por_material_anual (
  nome TEXT,
  referencia TEXT,
  kg REAL,
  gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 12) venda_por_material_diario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venda_por_material_diario (
  nome TEXT,
  data TEXT,
  kg REAL,
  gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 13) venda_por_material_mes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venda_por_material_mes (
  nome TEXT,
  referencia TEXT,
  kg REAL,
  gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 14) venda_por_material_anual
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venda_por_material_anual (
  nome TEXT,
  referencia TEXT,
  kg REAL,
  gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 15) ultimas_20
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ultimas_20 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT,
  material INTEGER,
  comanda INTEGER,
  preco_kg REAL,
  kg_total REAL,
  valor_total REAL,
  criado_por TEXT,
  atualizado_por TEXT,
  data_sync TEXT,
  origem_offline INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 16) estoque
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque (
  material TEXT,
  kg_total REAL,
  valor_medio_kg REAL,
  valor_total_gasto REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 17) despesa_mes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS despesa_mes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT,
  descricao TEXT,
  valor REAL,
  criado_por TEXT,
  atualizado_por TEXT,
  data_sync TEXT,
  origem_offline INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 18) calculo_fechamento
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculo_fechamento (
  desde_data TEXT,
  ate_data TEXT,
  compra REAL,
  despesa REAL,
  venda REAL,
  lucro REAL,
  data_sync TEXT
);

-- ---------------------------------------------------------------------
-- 19) sync_queue  (fila de sincronização)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,      -- 'INSERT', 'UPDATE', 'DELETE'
  record_id TEXT,
  payload TEXT NOT NULL,        -- JSON do registro
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced INTEGER DEFAULT 0      -- 0 = pendente, 1 = sincronizado
);

-- ---------------------------------------------------------------------
-- 20) resumo_estoque_financeiro (resumo financeiro do estoque)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumo_estoque_financeiro (
  total_kg REAL,
  total_custo REAL,
  total_venda_potencial REAL,
  lucro_potencial REAL,
  updated_at TEXT
);

COMMIT;
`;

// List of tables to verify after creation
const EXPECTED_TABLES = [
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

// Global SQLite connection instance
let sqliteConnection: SQLiteConnection | null = null;
let db: SQLiteDBConnection | null = null;
let isInitialized = false;

/**
 * Initialize the SQLite plugin and connection
 */
async function initializeSQLitePlugin(): Promise<SQLiteConnection> {
  if (sqliteConnection) {
    return sqliteConnection;
  }

  logger.info('🔌 Initializing SQLite plugin...');

  // Create a new SQLite connection
  sqliteConnection = new SQLiteConnection(CapacitorSQLite);

  // Initialize the Web Store for web platform (if needed)
  if (Capacitor.getPlatform() === 'web') {
    logger.info('🌐 Running on web platform - initializing jeep-sqlite...');
    
    // For web platform, we need to use jeep-sqlite custom element
    const jeepSqlite = document.createElement('jeep-sqlite');
    document.body.appendChild(jeepSqlite);
    
    await customElements.whenDefined('jeep-sqlite');
    await sqliteConnection.initWebStore();
    
    logger.info('✅ Web store initialized successfully');
  }

  logger.info('✅ SQLite plugin initialized successfully');
  return sqliteConnection;
}

/**
 * Check if database already exists
 */
async function checkDatabaseExists(connection: SQLiteConnection): Promise<boolean> {
  try {
    const result = await connection.isDatabase(DB_NAME, DB_ENCRYPTED);
    return result.result || false;
  } catch (error) {
    logger.error('Error checking if database exists:', error);
    return false;
  }
}

/**
 * Create the database and execute the schema
 */
async function createDatabase(connection: SQLiteConnection): Promise<SQLiteDBConnection> {
  logger.info('📦 Creating new database:', DB_NAME);

  // Create or open the database
  const database = await connection.createConnection(
    DB_NAME,
    DB_ENCRYPTED,
    DB_MODE,
    DB_VERSION,
    false // readonly = false
  );

  // Open the database
  await database.open();
  logger.info('✅ Database connection opened successfully');

  // Execute the schema to create all tables
  logger.info('🔨 Executing database schema...');
  await database.execute(DATABASE_SCHEMA);
  logger.info('✅ Database schema executed successfully');

  return database;
}

/**
 * Verify that all expected tables were created
 */
async function verifyTables(database: SQLiteDBConnection): Promise<void> {
  logger.info('🔍 Verifying database tables...');

  const query = `
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name;
  `;

  const result = await database.query(query);
  const createdTables = result.values?.map((row: any) => row.name) || [];

  logger.info('📋 Tables found in database:', createdTables);

  // Check if all expected tables exist
  const missingTables = EXPECTED_TABLES.filter(
    table => !createdTables.includes(table)
  );

  if (missingTables.length > 0) {
    logger.error('❌ Missing tables:', missingTables);
    throw new Error(`Database verification failed. Missing tables: ${missingTables.join(', ')}`);
  }

  logger.info(`✅ Database verification successful! All ${EXPECTED_TABLES.length} tables created correctly.`);
  
  // Log table count for each table
  for (const table of EXPECTED_TABLES) {
    try {
      const countResult = await database.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = countResult.values?.[0]?.count || 0;
      logger.info(`   📊 Table '${table}': ${count} rows`);
    } catch (error) {
      logger.warn(`   ⚠️ Could not count rows in '${table}':`, error);
    }
  }
}

/**
 * Initialize the SQLite database
 * This is the main entry point for database initialization
 * 
 * @returns The database connection instance
 */
export async function initializeDatabase(): Promise<SQLiteDBConnection> {
  // Return existing connection if already initialized
  if (isInitialized && db) {
    logger.info('✅ Database already initialized, returning existing connection');
    return db;
  }

  try {
    logger.info('🚀 Starting database initialization...');

    // Initialize SQLite plugin
    const connection = await initializeSQLitePlugin();

    // Check if database already exists
    const dbExists = await checkDatabaseExists(connection);

    if (dbExists) {
      logger.info('📂 Database already exists, opening connection...');
      
      // Open existing database
      db = await connection.createConnection(
        DB_NAME,
        DB_ENCRYPTED,
        DB_MODE,
        DB_VERSION,
        false
      );
      await db.open();
      
      logger.info('✅ Connected to existing database successfully');
    } else {
      logger.info('🆕 Database does not exist, creating new database...');
      
      // Create new database and execute schema
      db = await createDatabase(connection);
      
      logger.info('✅ New database created successfully');
    }

    // Verify all tables exist
    await verifyTables(db);

    // Mark as initialized
    isInitialized = true;

    logger.info('🎉 Database initialization completed successfully!');
    logger.info(`📍 Database location: ${DB_NAME}`);
    logger.info(`📊 Total tables: ${EXPECTED_TABLES.length}`);

    return db;

  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw new Error(`Failed to initialize SQLite database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the current database connection
 * Throws error if database is not initialized
 */
export function getDatabase(): SQLiteDBConnection {
  if (!db || !isInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Get the SQLite connection instance
 */
export function getSQLiteConnection(): SQLiteConnection {
  if (!sqliteConnection) {
    throw new Error('SQLite connection not initialized. Call initializeDatabase() first.');
  }
  return sqliteConnection;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      await db.close();
      logger.info('✅ Database connection closed successfully');
      db = null;
      isInitialized = false;
    } catch (error) {
      logger.error('❌ Error closing database:', error);
      throw error;
    }
  }
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return isInitialized && db !== null;
}

// Export database configuration constants
export const DB_CONFIG = {
  name: DB_NAME,
  version: DB_VERSION,
  encrypted: DB_ENCRYPTED,
  mode: DB_MODE,
  tables: EXPECTED_TABLES
} as const;
