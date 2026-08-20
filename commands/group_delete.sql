-- Soft-delete del grupo. Un grupo borrado no puede seguir exigiendo una eleccion en el TPV.
-- Sus opciones y sus enlaces caen en los dos ficheros siguientes del mismo command, que corre en
-- una sola transaccion. Van separados porque Postgres prepara cada fichero como UNA sentencia.
UPDATE modifiers_group
SET is_deleted = 1, deleted_at = :now, updated_by = :current_user_id, updated_at = :now
WHERE id = :group_id AND hub_id = :hub_id;
