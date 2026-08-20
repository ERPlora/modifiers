-- Grupos de modificadores del hub (ADR-0376). Runtime inyecta :hub_id.
-- min_choices >= 1 ES la obligatoriedad -- no hay columna `required`, a proposito.
-- max_choices = 0 significa sin techo.
SELECT id, name, kitchen_name, min_choices, max_choices, allow_repeat, sort_order
FROM modifiers_group
WHERE hub_id = :hub_id AND is_deleted = 0
