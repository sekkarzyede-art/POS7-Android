-- POS7 R341: additive metadata only; no updates/deletes to products, stocks, invoices, snapshots, or commands.
CREATE TABLE IF NOT EXISTS public.pos7_inventory_alias_r341 (
  store_id text NOT NULL DEFAULT 'pos7' CHECK (store_id = 'pos7'),
  alias_product_id text NOT NULL,
  canonical_product_id text NOT NULL,
  alias_barcode text NOT NULL CHECK (alias_barcode ~ '^[0-9]+$'),
  normalized_barcode text GENERATED ALWAYS AS (coalesce(nullif(ltrim(alias_barcode,'0'),''),'0')) STORED,
  status text NOT NULL DEFAULT 'approved' CHECK(status IN ('approved','pending_review')),
  source text NOT NULL DEFAULT 'owner_confirmed_leading_zero',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, alias_product_id),
  UNIQUE (store_id, alias_barcode),
  CHECK (alias_product_id <> canonical_product_id)
);
ALTER TABLE public.pos7_inventory_alias_r341 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos7_inventory_alias_r341 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pos7_inventory_alias_r341 TO authenticated;
DROP POLICY IF EXISTS pos7_inventory_alias_r341_read_owner ON public.pos7_inventory_alias_r341;
CREATE POLICY pos7_inventory_alias_r341_read_owner ON public.pos7_inventory_alias_r341 FOR SELECT TO authenticated
USING (public.pos7_is_member(store_id, ARRAY['owner']));
-- Seven legacy alias product identifiers. Canonical product is the corresponding barcode without leading zero.
-- Insert ONLY if both original records still exist and their normalized barcode matches.
WITH pairs(alias_id,primary_id) AS (
 VALUES
 ('1791754101767','1791754497879'),
 ('1791754402070','1791754737071'),
 ('1791754350187','1791754129679'),
 ('1791754445965','1791754307184'),
 ('1791754016462','1791754511142'),
 ('1791754238159','1791754676462'),
 ('1791754426381','1791754174407')
)
INSERT INTO public.pos7_inventory_alias_r341(store_id,alias_product_id,canonical_product_id,alias_barcode)
SELECT a.store_id,a.product_id,b.product_id,a.barcode
FROM pairs v
JOIN public.pos7_product_catalog a ON a.store_id='pos7' AND a.product_id=v.alias_id
JOIN public.pos7_product_catalog b ON b.store_id='pos7' AND b.product_id=v.primary_id
WHERE a.barcode ~ '^[0-9]+$' AND b.barcode ~ '^[0-9]+$'
 AND coalesce(nullif(ltrim(a.barcode,'0'),''),'0')=coalesce(nullif(ltrim(b.barcode,'0'),''),'0')
ON CONFLICT (store_id,alias_product_id) DO NOTHING;
-- Query only: never automatically merge legacy stock balances or mutate invoices.
CREATE OR REPLACE FUNCTION public.pos7_inventory_resolve_r341(p_barcode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_normalized text; v_matches jsonb; v_count int; v_canonical text; v_alias_count int;
BEGIN
  IF NOT public.pos7_is_member('pos7',ARRAY['owner']) THEN RAISE EXCEPTION 'inventory_owner_required'; END IF;
  IF p_barcode IS NULL OR btrim(p_barcode)='' THEN RAISE EXCEPTION 'barcode_required'; END IF;
  v_normalized:=CASE WHEN btrim(p_barcode) ~ '^[0-9]+$'
    THEN coalesce(nullif(ltrim(btrim(p_barcode),'0'),''),'0') ELSE btrim(p_barcode) END;
  SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',product_id,'name',name,'barcode',barcode)),'[]'::jsonb)
    INTO v_count,v_matches
  FROM public.pos7_product_catalog
  WHERE store_id='pos7' AND (
    CASE WHEN barcode ~ '^[0-9]+$'
      THEN coalesce(nullif(ltrim(barcode,'0'),''),'0') ELSE barcode END
  )=v_normalized;
  IF v_count=0 THEN RETURN jsonb_build_object('status','missing','matches',v_matches); END IF;
  IF v_count=1 THEN RETURN jsonb_build_object('status','unique','matches',v_matches,'product_id',v_matches->0->>'id'); END IF;
  SELECT count(distinct canonical_product_id),min(canonical_product_id) INTO v_alias_count,v_canonical
  FROM public.pos7_inventory_alias_r341 WHERE store_id='pos7' AND normalized_barcode=v_normalized AND status='approved';
  IF v_alias_count=1 AND EXISTS(
     SELECT 1 FROM public.pos7_product_catalog WHERE store_id='pos7' AND product_id=v_canonical
      AND (CASE WHEN barcode ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(barcode,'0'),''),'0') ELSE barcode END)=v_normalized
  ) AND NOT EXISTS(
     SELECT 1 FROM public.pos7_product_catalog c
     WHERE c.store_id='pos7' AND (CASE WHEN c.barcode ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(c.barcode,'0'),''),'0') ELSE c.barcode END)=v_normalized
       AND c.product_id<>v_canonical AND NOT EXISTS (
        SELECT 1 FROM public.pos7_inventory_alias_r341 a
        WHERE a.store_id='pos7' AND a.alias_product_id=c.product_id AND a.canonical_product_id=v_canonical AND a.status='approved')
  ) THEN
    RETURN jsonb_build_object('status','approved_alias','product_id',v_canonical,'matches',v_matches);
  END IF;
  RETURN jsonb_build_object('status','review','reason','ambiguous_barcode','matches',v_matches);
END;
$$;
REVOKE ALL ON FUNCTION public.pos7_inventory_resolve_r341(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_resolve_r341(text) TO authenticated;
