CREATE OR REPLACE FUNCTION public.pos7_sync_photo_catalog()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.store_id IS DISTINCT FROM 'pos7' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.sections->'products'
     IS NOT DISTINCT FROM OLD.sections->'products' THEN
    RETURN NEW;
  END IF;
  WITH source_products AS (
    SELECT p.key AS product_id,
           NULLIF(BTRIM(p.value->>'name'),'') AS name,
           NULLIF(BTRIM(p.value->>'barcode'),'') AS barcode
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(NEW.sections->'products')='object'
      THEN NEW.sections->'products' ELSE '{}'::jsonb END
    ) p(key,value)
    WHERE jsonb_typeof(p.value)='object'
  ),
  valid_products AS (
    SELECT DISTINCT ON (barcode) product_id,name,barcode
    FROM source_products
    WHERE product_id ~ '^[0-9]+$'
      AND LENGTH(product_id) BETWEEN 1 AND 128
      AND name IS NOT NULL AND LENGTH(name)<=500 AND barcode IS NOT NULL
    ORDER BY barcode,product_id
  ),
  existing AS MATERIALIZED (
    SELECT product_id,BTRIM(barcode) AS barcode
    FROM public.pos7_product_catalog
    WHERE store_id='pos7'
  )
  INSERT INTO public.pos7_product_catalog(store_id,product_id,name,barcode)
  SELECT 'pos7',v.product_id,v.name,v.barcode
  FROM valid_products v
  LEFT JOIN existing eid ON eid.product_id=v.product_id
  LEFT JOIN existing ebc ON ebc.barcode=v.barcode
  WHERE eid.product_id IS NULL AND ebc.product_id IS NULL
  ON CONFLICT (store_id,product_id) DO NOTHING;
  RETURN NEW;
END;
$function$
