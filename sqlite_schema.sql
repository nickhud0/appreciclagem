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
-- (removido) resumo_estoque_financeiro não é necessário

COMMIT;
