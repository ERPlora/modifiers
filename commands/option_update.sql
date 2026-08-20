-- Edicion de opcion. Runtime inyecta :hub_id, :current_user_id, :now.
UPDATE modifiers_option SET
  name = :name, kitchen_name = COALESCE(:kitchen_name, ''),
  price_delta = COALESCE(:price_delta, 0),
  tax_category_key = NULLIF(:tax_category_key, ''),
  sort_order = COALESCE(:sort_order, 0),
  updated_by = :current_user_id, updated_at = :now
WHERE id = :option_id AND hub_id = :hub_id AND is_deleted = 0;
