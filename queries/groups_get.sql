-- Detalle de un grupo por id. Runtime inyecta :hub_id.
SELECT id, name, kitchen_name, min_choices, max_choices, allow_repeat, sort_order
FROM modifiers_group
WHERE hub_id = :hub_id AND id = :group_id AND is_deleted = 0
