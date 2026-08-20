-- Soft-delete de una opcion.
UPDATE modifiers_option
SET is_deleted = 1, deleted_at = :now, updated_by = :current_user_id, updated_at = :now
WHERE id = :option_id AND hub_id = :hub_id;
