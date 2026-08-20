-- modifiers.items.list — el runtime aplica search/sort/filtros/paginación (motor de listas)
-- e inyecta hub_id. Devuelve la página + total para el pager.
SELECT id, name, code, amount, created_at
FROM modifiers_items
WHERE is_deleted = 0;
