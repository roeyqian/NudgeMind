-- Restore catalog content captured before migration 0007; preserve current inventory and user records.
-- Pair with the previous application code. The D1 migration ledger is intentionally unchanged.
UPDATE products SET
  name = (SELECT b.name FROM catalog_0007_products_backup b WHERE b.id = products.id),
  subtitle = (SELECT b.subtitle FROM catalog_0007_products_backup b WHERE b.id = products.id),
  description = (SELECT b.description FROM catalog_0007_products_backup b WHERE b.id = products.id),
  price = (SELECT b.price FROM catalog_0007_products_backup b WHERE b.id = products.id),
  original_price = (SELECT b.original_price FROM catalog_0007_products_backup b WHERE b.id = products.id),
  specs_json = (SELECT b.specs_json FROM catalog_0007_products_backup b WHERE b.id = products.id),
  tags_json = (SELECT b.tags_json FROM catalog_0007_products_backup b WHERE b.id = products.id),
  updated_at = (SELECT b.updated_at FROM catalog_0007_products_backup b WHERE b.id = products.id)
WHERE id IN (SELECT id FROM catalog_0007_products_backup);

DELETE FROM product_translations
WHERE locale = 'en' AND product_id IN (SELECT id FROM catalog_0007_products_backup)
  AND product_id NOT IN (SELECT product_id FROM catalog_0007_translations_backup);

INSERT INTO product_translations (product_id, locale, name, subtitle, description, specs_json, tags_json)
SELECT product_id, locale, name, subtitle, description, specs_json, tags_json FROM catalog_0007_translations_backup WHERE 1
ON CONFLICT (product_id, locale) DO UPDATE SET
  name = excluded.name,
  subtitle = excluded.subtitle,
  description = excluded.description,
  specs_json = excluded.specs_json,
  tags_json = excluded.tags_json;

DELETE FROM product_sources WHERE product_id IN (SELECT id FROM catalog_0007_products_backup);
