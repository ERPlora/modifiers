-- modifiers.items.get
SELECT id, name, code, amount, created_at, updated_at
FROM modifiers_items
WHERE id = :id AND is_deleted = 0;
