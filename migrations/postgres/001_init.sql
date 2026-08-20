-- modifiers: esquema inicial (Postgres), ADR-0376. El runtime añade hub_id + is_deleted/deleted_at
-- + created_by/updated_by/created_at/updated_at por contrato. Aquí solo el dominio.
--
-- OJO al escribir comentarios aquí: un punto y coma dentro de un comentario de dos guiones parte
-- la sentencia en los hubs pineados a tag (el fix del guard solo esta en develop, ningun tag hasta
-- v1.1.8 incluido). module-toolkit#70. Por eso en este fichero no hay ni uno.

-- GRUPO. Reutilizable, no pertenece a ningun articulo. La obligatoriedad es min_choices >= 1
-- (regla de Clover). NO existe un flag "required": un solo control con dos efectos es el bug
-- documentado de Square, donde "solo puede elegir uno" tambien impone un minimo de 1.
CREATE TABLE IF NOT EXISTS modifiers_group (
  id            TEXT PRIMARY KEY,
  hub_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  -- Nombre para la comanda, distinto del comercial (regla de Toast). Vacio = usa name.
  kitchen_name  TEXT NOT NULL DEFAULT '',
  min_choices   INTEGER NOT NULL DEFAULT 0,
  -- 0 = sin techo.
  max_choices   INTEGER NOT NULL DEFAULT 0,
  -- Permite elegir la misma opcion mas de una vez (panaderias, cafeterias).
  allow_repeat  INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at    TEXT,
  created_by    TEXT,
  updated_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_modifiers_group_hub ON modifiers_group (hub_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_modifiers_group_order ON modifiers_group (hub_id, sort_order, name);

-- OPCION. price_delta va en la unidad entera del contrato de dinero y puede ser negativo.
-- Un modificador NO es una variante: no lleva stock ni coste propio (frontera explicita de
-- Lightspeed). Descontar ingredientes es pm#116 y vive en otro sitio.
CREATE TABLE IF NOT EXISTS modifiers_option (
  id                 TEXT PRIMARY KEY,
  hub_id             TEXT NOT NULL,
  group_id           TEXT NOT NULL,
  name               TEXT NOT NULL,
  kitchen_name       TEXT NOT NULL DEFAULT '',
  price_delta        BIGINT NOT NULL DEFAULT 0,
  -- NULL = hereda la categoria fiscal de la linea de venta. Con valor, se aplica SOLO a su delta
  -- y nunca reescribe la del padre (ADR-0376). Toast permite lo contrario y documenta el agujero
  -- que abre, donde el resultado depende de CUANTOS modificadores se eligieron.
  tax_category_key   TEXT,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_deleted         INTEGER NOT NULL DEFAULT 0,
  deleted_at         TEXT,
  created_by         TEXT,
  updated_by         TEXT,
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES modifiers_group (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_modifiers_option_group ON modifiers_option (hub_id, group_id, sort_order);

-- ENLACE grupo <-> lo que se vende, con referencia OPACA. modifiers no aprende que es un producto
-- ni un servicio, asi que no aparece ningun depends_on en ninguna direccion. Mismo patron que las
-- retenciones de ADR-0375. Es la razon de ser del modulo: services no depende de inventory y no
-- puede empezar a hacerlo solo para que un salon cobre un suplemento.
CREATE TABLE IF NOT EXISTS modifiers_group_link (
  id           TEXT PRIMARY KEY,
  hub_id       TEXT NOT NULL,
  group_id     TEXT NOT NULL,
  -- product | service | category. Lightspeed permite colgar de categoria, no solo de articulo.
  target_kind  TEXT NOT NULL,
  -- El id de ese articulo, SIN clave ajena: quien vende es quien sabe que significa.
  target_ref   TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_deleted   INTEGER NOT NULL DEFAULT 0,
  deleted_at   TEXT,
  created_by   TEXT,
  updated_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES modifiers_group (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_modifiers_link_target ON modifiers_group_link (hub_id, target_kind, target_ref);
CREATE UNIQUE INDEX IF NOT EXISTS ux_modifiers_link
  ON modifiers_group_link (hub_id, group_id, target_kind, target_ref)
  WHERE is_deleted = 0;
