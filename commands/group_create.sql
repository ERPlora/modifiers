-- Alta de grupo de modificadores. Runtime inyecta :new_id, :hub_id, :current_user_id, :now.
-- min_choices >= 1 ES "obligatorio" -- no se declara un flag aparte (regla de Clover, y el
-- footgun documentado de Square es justo tener un control con dos efectos).
INSERT INTO modifiers_group
  (id, hub_id, name, kitchen_name, min_choices, max_choices, allow_repeat, sort_order,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :name, COALESCE(:kitchen_name, ''), COALESCE(:min_choices, 0),
   COALESCE(:max_choices, 0), COALESCE(:allow_repeat, 0), COALESCE(:sort_order, 0),
   0, :current_user_id, :current_user_id, :now, :now);
