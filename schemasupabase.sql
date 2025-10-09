-- =====================================================================
--  Reciclagem - Esquema de Banco (PostgreSQL / Supabase)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comanda_tipo') THEN
    CREATE TYPE comanda_tipo AS ENUM ('compra','venda');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_enum') THEN
    CREATE TYPE status_enum AS ENUM ('pendente','pago');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pendencia_tipo') THEN
    CREATE TYPE pendencia_tipo AS ENUM ('a_pagar','a_receber');
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS material (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome            TEXT        NOT NULL,
  categoria       TEXT        NOT NULL,
  preco_compra    NUMERIC(14,4) NOT NULL DEFAULT 0,
  preco_venda     NUMERIC(14,4) NOT NULL DEFAULT 0,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS comanda (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  codigo          TEXT        NOT NULL UNIQUE,
  tipo            comanda_tipo NOT NULL,
  observacoes     TEXT,
  total           NUMERIC(14,4) NOT NULL DEFAULT 0,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS item (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  material        BIGINT      NOT NULL REFERENCES material(id) ON DELETE RESTRICT,
  comanda         BIGINT      NOT NULL REFERENCES comanda(id)  ON DELETE CASCADE,
  preco_kg        NUMERIC(14,4) NOT NULL DEFAULT 0,
  kg_total        NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_total     NUMERIC(14,4) NOT NULL DEFAULT 0,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS fechamento (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  compra          NUMERIC(14,4) NOT NULL DEFAULT 0,
  despesa         NUMERIC(14,4) NOT NULL DEFAULT 0,
  venda           NUMERIC(14,4) NOT NULL DEFAULT 0,
  lucro           NUMERIC(14,4) NOT NULL DEFAULT 0,
  observacao      TEXT,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS vale (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          status_enum NOT NULL DEFAULT 'pendente',
  nome            TEXT        NOT NULL,
  valor           NUMERIC(14,4) NOT NULL DEFAULT 0,
  observacao      TEXT,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS pendencia (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          status_enum   NOT NULL DEFAULT 'pendente',
  nome            TEXT          NOT NULL,
  valor           NUMERIC(14,4) NOT NULL DEFAULT 0,
  tipo            pendencia_tipo NOT NULL,
  observacao      TEXT,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

CREATE TABLE IF NOT EXISTS despesa (
  id              BIGSERIAL PRIMARY KEY,
  data            TIMESTAMPTZ NOT NULL DEFAULT now(),
  descricao       TEXT        NOT NULL,
  valor           NUMERIC(14,4) NOT NULL DEFAULT 0,
  criado_por      TEXT        NOT NULL,
  atualizado_por  TEXT        NOT NULL
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_material_data       ON material (data DESC);
CREATE INDEX IF NOT EXISTS idx_material_nome       ON material (nome);
CREATE INDEX IF NOT EXISTS idx_comanda_data        ON comanda (data DESC);
CREATE INDEX IF NOT EXISTS idx_comanda_tipo        ON comanda (tipo);
CREATE INDEX IF NOT EXISTS idx_item_data           ON item (data DESC);
CREATE INDEX IF NOT EXISTS idx_item_material       ON item (material);
CREATE INDEX IF NOT EXISTS idx_item_comanda        ON item (comanda);
CREATE INDEX IF NOT EXISTS idx_fechamento_data     ON fechamento (data DESC);
CREATE INDEX IF NOT EXISTS idx_vale_status         ON vale (status);
CREATE INDEX IF NOT EXISTS idx_pendencia_status    ON pendencia (status);
CREATE INDEX IF NOT EXISTS idx_pendencia_tipo      ON pendencia (tipo);
CREATE INDEX IF NOT EXISTS idx_despesa_data        ON despesa (data DESC);

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------

-- 1) comanda_20: últimas 20 comandas + seus itens
CREATE OR REPLACE VIEW comanda_20 AS
WITH ultimas AS (
  SELECT c.id
  FROM comanda c
  ORDER BY c.data DESC, c.id DESC
  LIMIT 20
)
SELECT
  c.id            AS comanda_id,
  c.data          AS comanda_data,
  c.codigo,
  c.tipo          AS comanda_tipo,
  c.observacoes,
  c.total         AS comanda_total,
  i.id            AS item_id,
  i.data          AS item_data,
  i.material      AS material_id,
  i.preco_kg,
  i.kg_total,
  i.valor_total   AS item_valor_total
FROM comanda c
JOIN ultimas u ON u.id = c.id
LEFT JOIN item i ON i.comanda = c.id
ORDER BY c.data DESC, c.id DESC, i.id ASC;

-- 2) fechamento_mes
CREATE OR REPLACE VIEW fechamento_mes AS
SELECT *
FROM fechamento f
WHERE date_trunc('month', f.data) = date_trunc('month', now())
ORDER BY f.data DESC;

-- 3) calculo_fechamento
CREATE OR REPLACE VIEW calculo_fechamento AS
WITH ultimo AS (
  SELECT COALESCE(MAX(f.data), to_timestamp(0)) AS dt
  FROM fechamento f
),
compra AS (
  SELECT COALESCE(SUM(i.valor_total), 0)::NUMERIC(14,4) AS total_compra
  FROM item i
  JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'compra'
    AND i.data > (SELECT dt FROM ultimo)
),
venda AS (
  SELECT COALESCE(SUM(i.valor_total), 0)::NUMERIC(14,4) AS total_venda
  FROM item i
  JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'venda'
    AND i.data > (SELECT dt FROM ultimo)
),
gastos AS (
  SELECT COALESCE(SUM(d.valor), 0)::NUMERIC(14,4) AS total_despesa
  FROM despesa d
  WHERE d.data > (SELECT dt FROM ultimo)
)
SELECT
  (SELECT dt FROM ultimo)                   AS desde_data,
  now()                                     AS ate_data,
  (SELECT total_compra  FROM compra)        AS compra,
  (SELECT total_despesa FROM gastos)        AS despesa,
  (SELECT total_venda   FROM venda)         AS venda,
  ((SELECT total_venda FROM venda)
   - (SELECT total_compra FROM compra)
   - (SELECT total_despesa FROM gastos))::NUMERIC(14,4) AS lucro;

-- 4) relatorio_diario
CREATE OR REPLACE VIEW relatorio_diario AS
WITH compras AS (
  SELECT date_trunc('day', i.data) AS dia, SUM(i.valor_total) AS compra
  FROM item i JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'compra'
  GROUP BY 1
),
vendas AS (
  SELECT date_trunc('day', i.data) AS dia, SUM(i.valor_total) AS venda
  FROM item i JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'venda'
  GROUP BY 1
),
despesas AS (
  SELECT date_trunc('day', d.data) AS dia, SUM(d.valor) AS despesa
  FROM despesa d
  GROUP BY 1
)
SELECT
  d::date AS data,
  COALESCE(c.compra,0)::NUMERIC(14,4) AS compra,
  COALESCE(v.venda,0)::NUMERIC(14,4)  AS venda,
  COALESCE(e.despesa,0)::NUMERIC(14,4) AS despesa,
  (COALESCE(v.venda,0) - COALESCE(c.compra,0) - COALESCE(e.despesa,0))::NUMERIC(14,4) AS lucro
FROM generate_series(
       (SELECT MIN(mind) FROM (
          SELECT MIN(i.data) AS mind FROM item i
          UNION ALL
          SELECT MIN(d.data) AS mind FROM despesa d
       ) s),
       now(),
       interval '1 day'
     ) AS d
LEFT JOIN compras c  ON date_trunc('day', d) = c.dia
LEFT JOIN vendas v   ON date_trunc('day', d) = v.dia
LEFT JOIN despesas e ON date_trunc('day', d) = e.dia
ORDER BY data DESC;

-- 5) relatorio_mensal
CREATE OR REPLACE VIEW relatorio_mensal AS
WITH compras AS (
  SELECT date_trunc('month', i.data) AS mes, SUM(i.valor_total) AS compra
  FROM item i JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'compra'
  GROUP BY 1
),
vendas AS (
  SELECT date_trunc('month', i.data) AS mes, SUM(i.valor_total) AS venda
  FROM item i JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'venda'
  GROUP BY 1
),
despesas AS (
  SELECT date_trunc('month', d.data) AS mes, SUM(d.valor) AS despesa
  FROM despesa d
  GROUP BY 1
)
SELECT
  base.mes::date AS referencia,
  COALESCE(c.compra,0)::NUMERIC(14,4) AS compra,
  COALESCE(v.venda,0)::NUMERIC(14,4)  AS venda,
  COALESCE(e.despesa,0)::NUMERIC(14,4) AS despesa,
  (COALESCE(v.venda,0) - COALESCE(c.compra,0) - COALESCE(e.despesa,0))::NUMERIC(14,4) AS lucro
FROM (
  SELECT DISTINCT date_trunc('month', x.d)::date AS mes
  FROM (
    SELECT i.data AS d FROM item i
    UNION ALL
    SELECT d.data AS d FROM despesa d
  ) x
) base
LEFT JOIN compras c  ON c.mes = base.mes
LEFT JOIN vendas v   ON v.mes = base.mes
LEFT JOIN despesas e ON e.mes = base.mes
ORDER BY referencia DESC;

-- 6) relatorio_anual
CREATE OR REPLACE VIEW relatorio_anual AS
WITH compras AS (
  SELECT date_trunc('year', i.data) AS ano, SUM(i.valor_total) AS compra
  FROM item i JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'compra'
  GROUP BY 1
),
vendas AS (
  SELECT date_trunc('year', i.data) AS ano, SUM(i.valor_total) AS venda
  FROM item i JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'venda'
  GROUP BY 1
),
despesas AS (
  SELECT date_trunc('year', d.data) AS ano, SUM(d.valor) AS despesa
  FROM despesa d
  GROUP BY 1
)
SELECT
  base.ano::date AS referencia,
  COALESCE(c.compra,0)::NUMERIC(14,4) AS compra,
  COALESCE(v.venda,0)::NUMERIC(14,4)  AS venda,
  COALESCE(e.despesa,0)::NUMERIC(14,4) AS despesa,
  (COALESCE(v.venda,0) - COALESCE(c.compra,0) - COALESCE(e.despesa,0))::NUMERIC(14,4) AS lucro
FROM (
  SELECT DISTINCT date_trunc('year', x.d)::date AS ano
  FROM (
    SELECT i.data AS d FROM item i
    UNION ALL
    SELECT d.data AS d FROM despesa d
  ) x
) base
LEFT JOIN compras c  ON c.ano = base.ano
LEFT JOIN vendas v   ON v.ano = base.ano
LEFT JOIN despesas e ON e.ano = base.ano
ORDER BY referencia DESC;

-- 7) ultimas_20: últimos 20 itens
CREATE OR REPLACE VIEW ultimas_20 AS
SELECT *
FROM item
ORDER BY data DESC, id DESC
LIMIT 20;

-- 8) estoque
CREATE OR REPLACE VIEW estoque AS
WITH compras AS (
  SELECT
    i.material,
    SUM(i.kg_total)         AS kg_compra,
    SUM(i.valor_total)      AS gasto_compra
  FROM item i
  JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'compra'
  GROUP BY i.material
),
vendas AS (
  SELECT
    i.material,
    SUM(i.kg_total)         AS kg_venda,
    SUM(i.valor_total)      AS receita_venda
  FROM item i
  JOIN comanda c ON c.id = i.comanda
  WHERE c.tipo = 'venda'
  GROUP BY i.material
),
base AS (
  SELECT
    m.id AS material_id,
    m.nome AS material,
    COALESCE(c.kg_compra,0)    AS kg_compra,
    COALESCE(c.gasto_compra,0) AS gasto_compra,
    COALESCE(v.kg_venda,0)     AS kg_venda
  FROM material m
  LEFT JOIN compras c ON c.material = m.id
  LEFT JOIN vendas  v ON v.material = m.id
)
SELECT
  b.material,
  GREATEST(b.kg_compra - b.kg_venda, 0)::NUMERIC(14,4) AS kg_total,
  CASE 
    WHEN b.kg_compra > 0 THEN (b.gasto_compra / b.kg_compra)::NUMERIC(14,4)
    ELSE 0::NUMERIC(14,4)
  END AS valor_medio_kg,
  (CASE 
    WHEN b.kg_compra > 0 THEN (b.gasto_compra / b.kg_compra) * GREATEST(b.kg_compra - b.kg_venda, 0)
    ELSE 0
  END)::NUMERIC(14,4) AS valor_total_gasto
FROM base b
ORDER BY b.material;

-- 9) despesa_mes
CREATE OR REPLACE VIEW despesa_mes AS
SELECT *
FROM despesa d
WHERE date_trunc('month', d.data) = date_trunc('month', now())
ORDER BY d.data DESC, d.id DESC;

-- 10) compra_por_material_diario
CREATE OR REPLACE VIEW compra_por_material_diario AS
SELECT
  m.nome                              AS nome,
  date_trunc('day', i.data)::date     AS data,
  SUM(i.kg_total)::NUMERIC(14,4)      AS kg,
  SUM(i.valor_total)::NUMERIC(14,4)   AS gasto
FROM item i
JOIN comanda c ON c.id = i.comanda
JOIN material m ON m.id = i.material
WHERE c.tipo = 'compra'
GROUP BY m.nome, date_trunc('day', i.data)
ORDER BY data DESC, nome;

-- 11) compra_por_material_mes
CREATE OR REPLACE VIEW compra_por_material_mes AS
SELECT
  m.nome                              AS nome,
  date_trunc('month', i.data)::date   AS referencia,
  SUM(i.kg_total)::NUMERIC(14,4)      AS kg,
  SUM(i.valor_total)::NUMERIC(14,4)   AS gasto
FROM item i
JOIN comanda c ON c.id = i.comanda
JOIN material m ON m.id = i.material
WHERE c.tipo = 'compra'
GROUP BY m.nome, date_trunc('month', i.data)
ORDER BY referencia DESC, nome;

-- 12) compra_por_material_anual
CREATE OR REPLACE VIEW compra_por_material_anual AS
SELECT
  m.nome                              AS nome,
  date_trunc('year', i.data)::date    AS referencia,
  SUM(i.kg_total)::NUMERIC(14,4)      AS kg,
  SUM(i.valor_total)::NUMERIC(14,4)   AS gasto
FROM item i
JOIN comanda c ON c.id = i.comanda
JOIN material m ON m.id = i.material
WHERE c.tipo = 'compra'
GROUP BY m.nome, date_trunc('year', i.data)
ORDER BY referencia DESC, nome;

-- 13) venda_por_material_diario
CREATE OR REPLACE VIEW venda_por_material_diario AS
SELECT
  m.nome                              AS nome,
  date_trunc('day', i.data)::date     AS data,
  SUM(i.kg_total)::NUMERIC(14,4)      AS kg,
  SUM(i.valor_total)::NUMERIC(14,4)   AS gasto
FROM item i
JOIN comanda c ON c.id = i.comanda
JOIN material m ON m.id = i.material
WHERE c.tipo = 'venda'
GROUP BY m.nome, date_trunc('day', i.data)
ORDER BY data DESC, nome;

-- 14) venda_por_material_mes
CREATE OR REPLACE VIEW venda_por_material_mes AS
SELECT
  m.nome                              AS nome,
  date_trunc('month', i.data)::date   AS referencia,
  SUM(i.kg_total)::NUMERIC(14,4)      AS kg,
  SUM(i.valor_total)::NUMERIC(14,4)   AS gasto
FROM item i
JOIN comanda c ON c.id = i.comanda
JOIN material m ON m.id = i.material
WHERE c.tipo = 'venda'
GROUP BY m.nome, date_trunc('month', i.data)
ORDER BY referencia DESC, nome;

-- 15) venda_por_material_anual
CREATE OR REPLACE VIEW venda_por_material_anual AS
SELECT
  m.nome                              AS nome,
  date_trunc('year', i.data)::date    AS referencia,
  SUM(i.kg_total)::NUMERIC(14,4)      AS kg,
  SUM(i.valor_total)::NUMERIC(14,4)   AS gasto
FROM item i
JOIN comanda c ON c.id = i.comanda
JOIN material m ON m.id = i.material
WHERE c.tipo = 'venda'
GROUP BY m.nome, date_trunc('year', i.data)
ORDER BY referencia DESC, nome;

COMMIT;

-- =====================================================================
-- Banco pronto! ✅
-- =====================================================================

