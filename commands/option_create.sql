-- Alta de opcion. price_delta va en la unidad entera del contrato de dinero y puede ser negativo.
-- tax_category_key NULL = hereda el de la linea de venta. Con valor, se aplica SOLO a su delta y
-- NUNCA reescribe el del padre (ADR-0376) -- que es donde Toast tiene su agujero.
INSERT INTO modifiers_option
  (id, hub_id, group_id, name, kitchen_name, price_delta, tax_category_key, sort_order,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :group_id, :name, COALESCE(:kitchen_name, ''), COALESCE(:price_delta, 0),
   NULLIF(:tax_category_key, ''), COALESCE(:sort_order, 0),
   0, :current_user_id, :current_user_id, :now, :now);
