-- POS7 R341: read-only inventory barcode identity audit.
-- No stock, invoice, catalog or command rows are changed.
SELECT a.product_id AS left_id,a.name AS left_name,a.barcode AS left_barcode,
       b.product_id AS right_id,b.name AS right_name,b.barcode AS right_barcode
FROM public.pos7_product_catalog a
JOIN public.pos7_product_catalog b
  ON a.store_id=b.store_id AND a.product_id<b.product_id
 AND ltrim(a.barcode,'0')=ltrim(b.barcode,'0')
 AND a.barcode<>b.barcode
WHERE a.store_id='pos7' AND a.barcode ~ '^[0-9]+$' AND b.barcode ~ '^[0-9]+$'
ORDER BY a.name;

-- Pending inventory requests (metadata only, no mutation):
SELECT event_id,created_at,status,payload->>'product_id' AS product_id,
       payload->>'barcode' AS barcode,
       payload->>'baseline_qty' AS baseline_qty,
       payload->>'counted_qty' AS counted_qty
FROM public.pos7_owner_commands
WHERE store_id='pos7' AND event_type='inventory_count' AND status='pending';
