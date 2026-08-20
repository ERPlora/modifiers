-- Opciones de un grupo, en su orden de presentacion. Runtime inyecta :hub_id.
-- tax_category_key NULL = hereda la categoria fiscal de la linea de venta.
SELECT id, group_id, name, kitchen_name, price_delta, tax_category_key, sort_order
FROM modifiers_option
WHERE hub_id = :hub_id AND group_id = :group_id AND is_deleted = 0
ORDER BY sort_order, name
