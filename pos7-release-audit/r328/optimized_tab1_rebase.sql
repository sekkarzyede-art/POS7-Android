-- R325 / Store 1 only. Same-device restore adoption, NOT a publisher transfer.
-- Never run this Store1 routine on the separate Store2 project.
BEGIN;
CREATE SCHEMA IF NOT EXISTS pos7_transfer_private;
REVOKE ALL ON SCHEMA pos7_transfer_private FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS pos7_transfer_private.same_device_r325_receipts(
  request_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  device_id text NOT NULL,
  expected_revision bigint NOT NULL,
  replacement_sections jsonb NOT NULL,
  previous_snapshot jsonb NOT NULL,
  previous_catalog jsonb NOT NULL,
  previous_gate jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  result jsonb NOT NULL
);
REVOKE ALL ON pos7_transfer_private.same_device_r325_receipts
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.pos7_restore_same_device_r325(
 p_request_id uuid, p_device text, p_expected bigint, p_sections jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pos7_transfer_private,pg_temp
AS $r325$
DECLARE
 s public.pos7_owner_snapshot%rowtype;
 g public.pos7_inventory_gate_r152%rowtype;
 receipt pos7_transfer_private.same_device_r325_receipts%rowtype;
 original_catalog jsonb;
 new_catalog_count integer;
 bad_product_count integer;
 pending_count integer;
 result_data jsonb;
 section text;
 required text[] := ARRAY['cash','cashLedger','customers','expenses','meta',
 'payments','products','purchases','receipts','returns','sales','suppliers',
 'wallet','walletTx'];
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'r325_owner_authentication_required' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_device IS NULL
 OR length(p_device) NOT BETWEEN 8 AND 128
 OR p_device !~ '^[A-Za-z0-9_.-]+$'
 OR p_expected IS NULL
 OR jsonb_typeof(p_sections) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'r325_invalid_request'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_sections)) <> 14
 THEN RAISE EXCEPTION 'r325_incomplete_snapshot_sections'; END IF;
 FOREACH section IN ARRAY required LOOP
   IF jsonb_typeof(p_sections->section) IS DISTINCT FROM 'object'
   THEN RAISE EXCEPTION 'r325_missing_section_%',section; END IF;
 END LOOP;
 SELECT count(*) INTO new_catalog_count
 FROM jsonb_each(p_sections->'products');
 IF new_catalog_count < 1 OR new_catalog_count > 10000 THEN
   RAISE EXCEPTION 'r325_catalog_size_invalid';
 END IF;
 SELECT count(*) INTO bad_product_count
 FROM jsonb_each(p_sections->'products') AS e(k,v)
 WHERE jsonb_typeof(e.v) IS DISTINCT FROM 'object'
   OR length(e.k) NOT BETWEEN 1 AND 160
   OR nullif(btrim(e.v->>'name'),'') IS NULL;
 IF bad_product_count <> 0 THEN
   RAISE EXCEPTION 'r325_malformed_products';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_sections->'products') e(k,v)
 WHERE jsonb_typeof(e.v->'stock_revision') IS DISTINCT FROM 'number'
 OR coalesce(e.v->>'stock_revision','') !~ '^(0|[1-9][0-9]*)$'
 OR e.v->>'stock_revision_untrusted' IS DISTINCT FROM 'false')
 THEN RAISE EXCEPTION 'r325_product_revision_not_rebased'; END IF;

 -- Lock in same order as inventory writer and existing R305 transfer path.
 SELECT * INTO g FROM public.pos7_inventory_gate_r152
 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'r325_inventory_gate_missing'; END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot
 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'r325_cloud_snapshot_missing'; END IF;

 SELECT * INTO receipt FROM pos7_transfer_private.same_device_r325_receipts
 WHERE request_id=p_request_id;
 IF FOUND THEN
   IF receipt.owner_id IS DISTINCT FROM auth.uid()
   OR receipt.device_id IS DISTINCT FROM p_device
   OR receipt.replacement_sections IS DISTINCT FROM p_sections
   OR receipt.expected_revision IS DISTINCT FROM p_expected
   THEN RAISE EXCEPTION 'r325_request_reused_different_data'; END IF;
   RETURN receipt.result || jsonb_build_object('replayed',true);
 END IF;

 -- Strictly NO changing publisher, tablet binding, inventory gate or permissions.
 IF s.publisher_device IS DISTINCT FROM p_device
 OR g.approved_device IS DISTINCT FROM p_device
 THEN RAISE EXCEPTION 'r325_device_not_current_publisher'; END IF;
 IF s.revision IS DISTINCT FROM p_expected
 OR s.revision >= 9007199254740990
 THEN RAISE EXCEPTION 'r325_cloud_revision_changed'; END IF;

 SELECT count(*) INTO pending_count FROM public.pos7_owner_commands
 WHERE store_id='pos7' AND status='pending';
 IF EXISTS(SELECT 1 FROM public.pos7_owner_commands
   WHERE store_id='pos7' AND status='pending' AND event_type<>'inventory_count')
 THEN RAISE EXCEPTION 'r325_pending_financial_phone_commands'; END IF;

 LOCK TABLE public.pos7_product_catalog IN SHARE ROW EXCLUSIVE MODE;
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb)
 INTO original_catalog FROM public.pos7_product_catalog c
 WHERE c.store_id='pos7';

 result_data:=jsonb_build_object('ok',true,'revision',s.revision+1,
   'publisher_device',s.publisher_device,
   'approved_device',g.approved_device,
   'catalog_count',new_catalog_count,
   'request_id',p_request_id,'fingerprint',md5(p_sections::text),
   'replayed',false);
 INSERT INTO pos7_transfer_private.same_device_r325_receipts(
   request_id,owner_id,device_id,expected_revision,replacement_sections,
   previous_snapshot,previous_catalog,previous_gate,result)
 VALUES(p_request_id,auth.uid(),p_device,p_expected,p_sections,
   to_jsonb(s),original_catalog,to_jsonb(g),result_data);

 -- Make the entire previous cloud snapshot and catalog recoverable.
 UPDATE public.pos7_owner_snapshot
 SET sections=p_sections, revision=s.revision+1,updated_at=clock_timestamp()
 WHERE store_id='pos7';
 -- Rewrite the derived catalog in the same transaction as the source snapshot.
 -- Keep its existing stable ID/locale/barcode semantics, including barcode: keys.
 INSERT INTO public.pos7_product_catalog(
   store_id,product_id,name,barcode,updated_at
 )
 SELECT 'pos7',e.k,e.v->>'name',coalesce(e.v->>'barcode',''),clock_timestamp()
 FROM jsonb_each(p_sections->'products') e(k,v)
 ON CONFLICT (store_id,product_id)
 DO UPDATE SET name=EXCLUDED.name,barcode=EXCLUDED.barcode,
               updated_at=EXCLUDED.updated_at
 WHERE public.pos7_product_catalog.name IS DISTINCT FROM EXCLUDED.name
    OR public.pos7_product_catalog.barcode IS DISTINCT FROM EXCLUDED.barcode;
 -- JSONB key existence is indexed by the in-memory JSONB object; avoid
 -- re-expanding 4413 object keys once for every 4407 catalog row.
 DELETE FROM public.pos7_product_catalog c
 WHERE c.store_id='pos7'
   AND NOT (p_sections->'products' ? c.product_id);
 -- No modification to publisher_device, gate, command queue, R174 guard or members.
 RETURN result_data;
END $r325$;

CREATE OR REPLACE FUNCTION public.pos7_restore_same_device_status_r325(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pos7_transfer_private,pg_temp AS $status$
DECLARE r pos7_transfer_private.same_device_r325_receipts%rowtype;
 s public.pos7_owner_snapshot%rowtype;
 g public.pos7_inventory_gate_r152%rowtype;
 current_count int;
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'r325_owner_authentication_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM pos7_transfer_private.same_device_r325_receipts
 WHERE request_id=p_request_id AND owner_id=auth.uid();
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','receipt_missing'); END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7';
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7';
 SELECT count(*) INTO current_count FROM public.pos7_product_catalog
 WHERE store_id='pos7';
 RETURN jsonb_build_object('ok',s.sections=r.replacement_sections
 AND s.revision=(r.result->>'revision')::bigint
 AND s.publisher_device=r.device_id
 AND g.approved_device=r.device_id
 AND current_count=(r.result->>'catalog_count')::int,
 'same_device',s.publisher_device=r.device_id AND g.approved_device=r.device_id,
 'revision',s.revision,'expected_revision',(r.result->>'revision')::bigint,
 'catalog_count',current_count,
 'fingerprint',md5(s.sections::text),
 'expected_fingerprint',md5(r.replacement_sections::text));
END $status$;

REVOKE ALL ON FUNCTION public.pos7_restore_same_device_r325(uuid,text,bigint,jsonb)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pos7_restore_same_device_status_r325(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos7_restore_same_device_r325(uuid,text,bigint,jsonb)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos7_restore_same_device_status_r325(uuid)
 TO authenticated;
COMMIT;
