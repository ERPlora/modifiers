-- modifiers.items.create — hub_id + created_by/updated_by los inyecta el runtime.
INSERT INTO modifiers_items (id, name, code, amount)
VALUES (:id, :name, :code, :amount);
