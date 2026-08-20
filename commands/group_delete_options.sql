-- Arrastra las opciones del grupo borrado.
UPDATE modifiers_option
SET is_deleted = 1, deleted_at = :now, updated_by = :current_user_id, updated_at = :now
WHERE group_id = :group_id AND hub_id = :hub_id AND is_deleted = 0;
