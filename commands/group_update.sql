-- Edicion de grupo. Runtime inyecta :hub_id, :current_user_id, :now.
UPDATE modifiers_group SET
  name = :name, kitchen_name = COALESCE(:kitchen_name, ''),
  min_choices = COALESCE(:min_choices, 0), max_choices = COALESCE(:max_choices, 0),
  allow_repeat = COALESCE(:allow_repeat, 0), sort_order = COALESCE(:sort_order, 0),
  updated_by = :current_user_id, updated_at = :now
WHERE id = :group_id AND hub_id = :hub_id AND is_deleted = 0;
