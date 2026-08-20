-- LO QUE CONSUME EL TPV. Dado lo que se va a vender, devuelve sus grupos con sus opciones ya
-- aplanados, en el orden de presentacion, en UNA sola llamada (nada de N+1 por grupo).
--
-- El enlace es OPACO: :target_kind es product|service|category y :target_ref es el id que maneje
-- quien vende. Este modulo no sabe que es un producto ni un servicio, y por eso no depende de
-- inventory ni de services (ADR-0376).
--
-- El CAST del bind no es adorno: Postgres fija el tipo de un parametro en su PRIMERA aparicion
-- y un IS NULL no aporta ninguno, asi que sin el CAST el PREPARE muere con 42P08 en cuanto
-- llega NULL, y la query no corre en ningun hub (ADR-0154 / ADR-0007).
--
-- :category_ref es opcional y permite heredar los grupos colgados de la categoria del articulo,
-- como hace Lightspeed. NULL = solo los del propio articulo.
SELECT
  g.id            AS group_id,
  g.name          AS group_name,
  g.kitchen_name  AS group_kitchen_name,
  g.min_choices   AS min_choices,
  g.max_choices   AS max_choices,
  g.allow_repeat  AS allow_repeat,
  g.sort_order    AS group_sort_order,
  o.id            AS option_id,
  o.name          AS option_name,
  o.kitchen_name  AS option_kitchen_name,
  o.price_delta   AS price_delta,
  o.tax_category_key AS tax_category_key,
  o.sort_order    AS option_sort_order
FROM modifiers_group_link l
JOIN modifiers_group g
  ON g.id = l.group_id AND g.hub_id = l.hub_id AND g.is_deleted = 0
LEFT JOIN modifiers_option o
  ON o.group_id = g.id AND o.hub_id = g.hub_id AND o.is_deleted = 0
WHERE l.hub_id = :hub_id
  AND l.is_deleted = 0
  AND (
        (l.target_kind = :target_kind AND l.target_ref = :target_ref)
     OR (CAST(:category_ref AS TEXT) IS NOT NULL AND l.target_kind = 'category'
         AND l.target_ref = :category_ref)
      )
ORDER BY g.sort_order, g.name, o.sort_order, o.name
