-- CATALOGO COMPLETO de opciones, para que el precio de un suplemento NO lo ponga el cliente.
--
-- `sales` resuelve el precio del producto contra `inventory.products.for_sale` y trata el del
-- payload como una propuesta, no como un hecho. Un suplemento es dinero igual: sin una lectura
-- autoritativa, un cliente que enviara price_delta negativo se estaria haciendo un descuento.
--
-- Sin bloque `list` A PROPOSITO: una read paginada entregaria 50 filas y callaria sobre el resto
-- (hub#650). Para una autoridad de precio eso no es un fallo de pantalla, es un agujero.
--
-- Devuelve tambien group_id y las reglas del grupo, para que quien verifique pueda comprobar de
-- paso que la opcion pertenece a un grupo enganchado a lo que se esta vendiendo.
SELECT
  o.id               AS option_id,
  o.group_id         AS group_id,
  o.name             AS name,
  o.kitchen_name     AS kitchen_name,
  o.price_delta      AS price_delta,
  o.tax_category_key AS tax_category_key,
  g.min_choices      AS min_choices,
  g.max_choices      AS max_choices,
  g.allow_repeat     AS allow_repeat
FROM modifiers_option o
JOIN modifiers_group g
  ON g.id = o.group_id AND g.hub_id = o.hub_id AND g.is_deleted = 0
WHERE o.hub_id = :hub_id AND o.is_deleted = 0
ORDER BY g.sort_order, g.name, o.sort_order, o.name
