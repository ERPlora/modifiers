-- Suelta el grupo de ese articulo. Soft-delete para que el indice unico parcial deje volver a
-- engancharlo despues.
UPDATE modifiers_group_link
SET is_deleted = 1, deleted_at = :now, updated_by = :current_user_id, updated_at = :now
WHERE hub_id = :hub_id AND group_id = :group_id
  AND target_kind = :target_kind AND target_ref = :target_ref AND is_deleted = 0;
