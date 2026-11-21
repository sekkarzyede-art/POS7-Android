BEGIN;
CREATE SCHEMA IF NOT EXISTS pos7_transfer_private;
REVOKE ALL ON SCHEMA pos7_transfer_private FROM PUBLIC, anon, authenticated;
CREATE TABLE pos7_transfer_private.receipts (
 request_id uuid PRIMARY KEY,
 owner_id uuid NOT NULL,
 device_id text NOT NULL,
 replacement_sections jsonb NOT NULL,
 previous_snapshot jsonb NOT NULL,
 previous_gate jsonb NOT NULL,
 previous_commands jsonb NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 result jsonb NOT NULL
);
REVOKE ALL ON pos7_transfer_private.receipts FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.pos7_restore_transfer_r305(
 p_request_id uuid, p_device text, p_expected bigint, p_sections jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pos7_transfer_private, pg_temp
AS $fn$
DECLARE
 s public.pos7_owner_snapshot%rowtype;
 g public.pos7_inventory_gate_r152%rowtype;
 r pos7_transfer_private.receipts%rowtype;
 commands jsonb; answer jsonb; section text;
 required text[] := ARRAY['cash','cashLedger','customers','expenses','meta','payments',
 'products','purchases','receipts','returns','sales','suppliers','wallet','walletTx'];
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'owner_authentication_required' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_device IS NULL OR length(p_device) NOT BETWEEN 8 AND 128
 OR p_device !~ '^[A-Za-z0-9_.-]+$' OR p_expected IS NULL
 OR jsonb_typeof(p_sections) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'invalid_transfer_request';
 END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_sections)) <> 14 THEN
  RAISE EXCEPTION 'invalid_section_count';
 END IF;
 FOREACH section IN ARRAY required LOOP
  IF jsonb_typeof(p_sections->section) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'invalid_backup_section_%',section;
  END IF;
 END LOOP;
 -- Same lock order as the deployed inventory commit RPC.
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inventory_gate_missing'; END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'snapshot_missing'; END IF;
 SELECT * INTO r FROM pos7_transfer_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF r.owner_id IS DISTINCT FROM auth.uid() OR r.device_id IS DISTINCT FROM p_device
  OR r.replacement_sections IS DISTINCT FROM p_sections THEN
   RAISE EXCEPTION 'transfer_request_reused_with_different_data';
  END IF;
  RETURN r.result || jsonb_build_object('replayed',true);
 END IF;
 IF s.revision IS DISTINCT FROM p_expected OR s.revision >= 9007199254740990 THEN
  RAISE EXCEPTION 'cloud_revision_changed_retry';
 END IF;
 -- Serialize queue writers during archiving. The authoritative backup excludes old pending commands.
 LOCK TABLE public.pos7_owner_commands IN SHARE ROW EXCLUSIVE MODE;
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO commands
 FROM public.pos7_owner_commands c WHERE store_id='pos7';
 answer := jsonb_build_object('ok',true,'revision',s.revision+1,
  'publisher_device',p_device,'request_id',p_request_id,'replayed',false);
 INSERT INTO pos7_transfer_private.receipts
 (request_id,owner_id,device_id,replacement_sections,previous_snapshot,previous_gate,previous_commands,result)
 VALUES(p_request_id,auth.uid(),p_device,p_sections,to_jsonb(s),to_jsonb(g),commands,answer);
 UPDATE public.pos7_owner_commands
 SET status='rejected',processed_at=clock_timestamp(),
 result=jsonb_build_object('reason','superseded_by_authoritative_backup','request_id',p_request_id)
 WHERE store_id='pos7' AND status='pending';
 UPDATE public.pos7_owner_snapshot
 SET sections=p_sections,publisher_device=p_device,revision=s.revision+1,updated_at=clock_timestamp()
 WHERE store_id='pos7';
 UPDATE public.pos7_inventory_gate_r152
 SET approved_device=p_device,enabled=true WHERE store_id='pos7';
 IF to_regclass('public.pos7_store2_clone_guard_r218') IS NOT NULL THEN
  EXECUTE 'UPDATE public.pos7_store2_clone_guard_r218 SET blocked=false,reason=$1,updated_at=clock_timestamp() WHERE store_id=$2'
  USING 'authoritative_backup_transfer_r305','pos7';
 END IF;
 RETURN answer;
END $fn$;
REVOKE ALL ON FUNCTION public.pos7_restore_transfer_r305(uuid,text,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos7_restore_transfer_r305(uuid,text,bigint,jsonb) TO authenticated;
-- A publisher change is accepted only when accompanied by its atomic transfer receipt.
CREATE FUNCTION pos7_transfer_private.guard_publisher_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pos7_transfer_private,pg_temp AS $guard$
BEGIN
 IF NEW.publisher_device IS DISTINCT FROM OLD.publisher_device
 AND EXISTS(SELECT 1 FROM pos7_transfer_private.receipts)
 AND NOT EXISTS(
  SELECT 1 FROM pos7_transfer_private.receipts
  WHERE device_id=NEW.publisher_device AND replacement_sections=NEW.sections
  AND (result->>'revision')::bigint=NEW.revision
  AND completed_at>=transaction_timestamp()
 ) THEN
  RAISE EXCEPTION 'use_backup_transfer_for_new_tablet';
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION pos7_transfer_private.guard_publisher_change() FROM PUBLIC;
CREATE TRIGGER pos7_publisher_transfer_guard_r305
BEFORE UPDATE ON public.pos7_owner_snapshot
FOR EACH ROW EXECUTE FUNCTION pos7_transfer_private.guard_publisher_change();
CREATE OR REPLACE FUNCTION public.pos7_inventory_commit_batch_r212(p_ids uuid[], p_verified_tablet_stock boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid; v_device text; v_cmd record; v_product jsonb; v_snapshot record;
v_out jsonb:='[]'::jsonb; v_result jsonb; v_count int; 
BEGIN
 IF EXISTS(SELECT 1 FROM pos7_transfer_private.receipts) THEN
 RAISE EXCEPTION 'use_device_bound_inventory_commit'; END IF;
 IF NOT public.pos7_is_member('pos7',ARRAY['owner']) THEN RAISE EXCEPTION 'inventory_owner_required'; END IF;
 IF p_verified_tablet_stock IS DISTINCT FROM true THEN RAISE EXCEPTION 'confirm_tablet_stock_before_approval'; END IF;
 v_count:=coalesce(array_length(p_ids,1),0);
 IF v_count<1 OR v_count>30 THEN RAISE EXCEPTION 'inventory_batch_limit_1_to_30'; END IF;
 IF (SELECT count(distinct x) FROM unnest(p_ids) x) <> v_count THEN RAISE EXCEPTION 'inventory_duplicate_events'; END IF;
 SELECT approved_device INTO v_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' AND enabled=true;
 IF v_device IS NULL THEN RAISE EXCEPTION 'inventory_gate_not_ready'; END IF;
 FOREACH v_id IN ARRAY p_ids LOOP
   BEGIN
     SELECT * INTO v_cmd FROM public.pos7_owner_commands WHERE store_id='pos7' AND event_id=v_id;
     IF NOT FOUND THEN RAISE EXCEPTION 'unknown_event'; END IF;
     IF v_cmd.status='processed' THEN
       v_result:=jsonb_build_object('event_id',v_id,'status','already_processed','result',v_cmd.result);
     ELSE
       IF v_cmd.status<>'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
       IF v_cmd.created_at <= now()-interval '24 hours' THEN RAISE EXCEPTION 'old_request_requires_manual_review'; END IF;
       SELECT * INTO v_snapshot FROM public.pos7_owner_snapshot WHERE store_id='pos7';
       v_product:=v_snapshot.sections->'products'->(v_cmd.payload->>'product_id');
       IF v_product->>'barcode' IS DISTINCT FROM v_cmd.payload->>'barcode' THEN RAISE EXCEPTION 'barcode_mismatch'; END IF;
       IF v_product->'stock' IS DISTINCT FROM v_cmd.payload->'baseline_qty' THEN RAISE EXCEPTION 'cloud_stock_changed'; END IF;
       IF v_product->'stock_revision' IS DISTINCT FROM v_cmd.payload->'stock_revision' THEN RAISE EXCEPTION 'cloud_stock_revision_changed'; END IF;
       v_result:=public.pos7_inventory_commit_r155(v_id,v_device);
       v_result:=jsonb_build_object('event_id',v_id,'status','committed','result',v_result);
     END IF;
   EXCEPTION WHEN OTHERS THEN
     v_result:=jsonb_build_object('event_id',v_id,'status','blocked','reason',SQLERRM);
   END;
   v_out:=v_out||jsonb_build_array(v_result);
 END LOOP;
 RETURN jsonb_build_object('items',v_out,'processed_count',(SELECT count(*) FROM jsonb_array_elements(v_out) i WHERE i->>'status'='committed'));
END $function$
;
COMMIT;

