-- Y suelta el grupo de todo lo que lo tuviera enganchado.
UPDATE modifiers_group_link
SET is_deleted = 1, deleted_at = :now, updated_by = :current_user_id, updated_at = :now
WHERE group_id = :group_id AND hub_id = :hub_id AND is_deleted = 0;
