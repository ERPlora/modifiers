-- Engancha un grupo a lo que se vende, por referencia OPACA. No hay clave ajena hacia otro modulo
-- ni depends_on: quien vende es quien sabe que significa :target_ref.
-- El indice unico parcial ux_modifiers_link impide duplicar el mismo enlace vivo.
INSERT INTO modifiers_group_link
  (id, hub_id, group_id, target_kind, target_ref, sort_order,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :group_id, :target_kind, :target_ref, COALESCE(:sort_order, 0),
   0, :current_user_id, :current_user_id, :now, :now);
