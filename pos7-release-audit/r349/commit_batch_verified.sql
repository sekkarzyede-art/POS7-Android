CREATE OR REPLACE FUNCTION public.pos7_inventory_commit_batch_r254(p_ids uuid[], p_device text, p_verified_tablet_stock boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_count integer; v_batch text; v_item record; v_gate record; v_snapshot record;
 v_id uuid; v_result jsonb; v_results jsonb := '[]'::jsonb;
 v_command record; v_payload jsonb; v_product jsonb; v_pid text; v_barcode text;
 v_old bigint; v_baseline bigint; v_new bigint; v_stock_rev bigint; v_payload_rev bigint;
 v_max constant bigint := 9007199254740991; v_catalog jsonb; v_changes jsonb:='{}'::jsonb; v_cursor bigint; v_seen text[]:=ARRAY[]::text[];
BEGIN
 IF NOT public.pos7_is_member('pos7',ARRAY['owner']) THEN RAISE EXCEPTION 'inventory_owner_required'; END IF;
 IF p_verified_tablet_stock IS DISTINCT FROM true THEN RAISE EXCEPTION 'confirm_tablet_stock_before_approval'; END IF;
 IF EXISTS (SELECT 1 FROM public.pos7_store2_clone_guard_r218 WHERE store_id='pos7' AND blocked) THEN RAISE EXCEPTION 'store2_inventory_blocked'; END IF;
 v_count:=coalesce(cardinality(p_ids),0);
 IF v_count<1 OR v_count>30 OR p_ids IS NULL OR array_position(p_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'inventory_batch_limit_1_to_30'; END IF;
 IF (SELECT count(DISTINCT x) FROM unnest(p_ids) AS u(x))<>v_count THEN RAISE EXCEPTION 'inventory_duplicate_events'; END IF;
 SELECT * INTO v_gate FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR v_gate.enabled IS DISTINCT FROM true OR v_gate.approved_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'inventory_gate_disabled'; END IF;
 SELECT * INTO v_snapshot FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR v_snapshot.publisher_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'inventory_publisher_device_mismatch'; END IF;
 IF jsonb_typeof(v_snapshot.sections->'products') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'inventory_snapshot_invalid'; END IF;
 IF p_device IS NULL OR length(p_device)<8 THEN RAISE EXCEPTION 'inventory_invalid_request'; END IF;
 v_catalog:=v_snapshot.sections->'products';v_cursor:=v_snapshot.revision;
 FOR v_item IN
   SELECT u.id,c.event_id,c.status,c.event_type,c.payload
   FROM unnest(p_ids) WITH ORDINALITY AS u(id,position)
   LEFT JOIN public.pos7_owner_commands c ON c.store_id='pos7' AND c.event_id=u.id
   ORDER BY u.position
 LOOP
   IF v_item.event_id IS NULL OR v_item.status IS DISTINCT FROM 'pending'
     OR v_item.event_type IS DISTINCT FROM 'inventory_count' THEN RAISE EXCEPTION 'inventory_batch_command_not_pending'; END IF;
   IF v_item.payload->>'batch_id' IS NULL OR length(v_item.payload->>'batch_id')<4
      OR (v_batch IS NOT NULL AND v_item.payload->>'batch_id' IS DISTINCT FROM v_batch) THEN
      RAISE EXCEPTION 'inventory_batch_identity_mismatch'; END IF;
   v_batch := v_item.payload->>'batch_id';
   IF v_catalog->(v_item.payload->>'product_id')->>'barcode'
     IS DISTINCT FROM v_item.payload->>'barcode' THEN RAISE EXCEPTION 'inventory_batch_barcode_mismatch'; END IF;
   IF (v_catalog->(v_item.payload->>'product_id')->>'stock')::numeric
      IS DISTINCT FROM (v_item.payload->>'baseline_qty')::numeric THEN RAISE EXCEPTION 'inventory_batch_stock_changed'; END IF;
   IF (v_catalog->(v_item.payload->>'product_id')->>'stock_revision')
      IS DISTINCT FROM v_item.payload->>'stock_revision' THEN RAISE EXCEPTION 'inventory_batch_revision_changed'; END IF;
 END LOOP;
 FOREACH v_id IN ARRAY p_ids LOOP
 SELECT * INTO v_command FROM public.pos7_owner_commands
 WHERE store_id='pos7' AND event_id=v_id FOR UPDATE;
 IF NOT FOUND OR v_command.event_type IS DISTINCT FROM 'inventory_count'
    OR (v_command.device_id IS NULL OR v_command.device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
   RAISE EXCEPTION 'inventory_command_invalid';
 END IF;
 -- Already processed is an idempotent read, never a second write.
 IF v_command.status='processed' THEN
   IF v_command.result->>'commit_protocol' IS DISTINCT FROM 'r155' OR
      v_command.result->>'event_id' IS DISTINCT FROM v_id::text THEN
     RAISE EXCEPTION 'inventory_processed_by_other_protocol';
   END IF;
   RAISE EXCEPTION 'inventory_batch_command_not_pending';
 END IF;
 IF v_command.status IS DISTINCT FROM 'pending' THEN
   RAISE EXCEPTION 'inventory_command_not_pending';
 END IF;
 v_payload:=v_command.payload;
 IF jsonb_typeof(v_payload) IS DISTINCT FROM 'object' OR
    v_payload->>'requires_tablet_validation' IS DISTINCT FROM 'true' OR
    v_payload->>'source' IS DISTINCT FROM 'owner_phone_inventory' THEN
   RAISE EXCEPTION 'inventory_payload_invalid';
 END IF;
 v_pid:=v_payload->>'product_id';
 IF v_pid=ANY(v_seen) THEN RAISE EXCEPTION 'duplicate_product_in_single_batch'; END IF;
 v_seen:=array_append(v_seen,v_pid);
 v_barcode:=v_payload->>'barcode';
 v_batch:=v_payload->>'batch_id';
 IF v_pid IS NULL OR v_pid='' OR v_barcode IS NULL OR btrim(v_barcode)='' OR
    v_batch IS NULL OR length(v_batch)<4 OR length(v_batch)>128 OR
    v_batch='INV-mwfb3jy6-fhbbwn9e' THEN
   RAISE EXCEPTION 'inventory_identity_invalid';
 END IF;
 IF jsonb_typeof(v_payload->'baseline_qty') IS DISTINCT FROM 'number' OR
    jsonb_typeof(v_payload->'counted_qty') IS DISTINCT FROM 'number' OR
    (v_payload->>'baseline_qty') !~ '^-?(0|[1-9][0-9]*)$' OR
    (v_payload->>'counted_qty') !~ '^(0|[1-9][0-9]*)$' OR
    length(v_payload->>'baseline_qty')>16 OR length(v_payload->>'counted_qty')>16 THEN
   RAISE EXCEPTION 'inventory_quantity_invalid';
 END IF;
 v_baseline:=(v_payload->>'baseline_qty')::bigint;
 v_new:=(v_payload->>'counted_qty')::bigint;
 IF abs(v_baseline)>v_max OR v_new>v_max THEN
   RAISE EXCEPTION 'inventory_quantity_unsafe';
 END IF;
 v_product:=coalesce(v_changes->v_pid,v_catalog->v_pid);
 IF jsonb_typeof(v_product) IS DISTINCT FROM 'object' OR
    v_product->>'id' IS DISTINCT FROM v_pid OR
    v_product->>'barcode' IS DISTINCT FROM v_barcode THEN
   RAISE EXCEPTION 'inventory_product_identity_mismatch';
 END IF;
 -- R248: allow numeric whole values such as 0.0; reject fractional stock safely.
 IF jsonb_typeof(v_product->'stock') IS DISTINCT FROM 'number'
    OR coalesce((v_product->>'stock') ~ '^-?(0|[1-9][0-9]*)([.]0+)?$',false) IS DISTINCT FROM true
    OR length(v_product->>'stock')>32 THEN
   RAISE EXCEPTION 'inventory_current_stock_invalid';
 END IF;
 v_old:=(v_product->>'stock')::numeric::bigint;
 IF abs(v_old)>v_max OR v_old<>v_baseline THEN
   RAISE EXCEPTION 'inventory_stale_baseline';
 END IF;
 -- R172: require the phone baseline stock revision to match the cloud revision.
 IF coalesce(v_product->>'stock_revision','') !~ '^(0|[1-9][0-9]*)$'
    OR length(v_product->>'stock_revision')>15
    OR coalesce(v_payload->>'stock_revision','') !~ '^(0|[1-9][0-9]*)$'
    OR length(v_payload->>'stock_revision')>15 THEN
   RAISE EXCEPTION 'inventory_revision_required';
 END IF;
 v_stock_rev:=(v_product->>'stock_revision')::bigint;
 v_payload_rev:=(v_payload->>'stock_revision')::bigint;
 IF v_payload_rev<>v_stock_rev THEN
   RAISE EXCEPTION 'inventory_stale_stock_revision';
 END IF;
 IF v_stock_rev>=9007199254740990 THEN
   RAISE EXCEPTION 'inventory_revision_overflow';
 END IF;
 -- Keep every other product field and every other snapshot section untouched.
 v_changes:=v_changes||jsonb_build_object(v_pid,v_product||jsonb_build_object('stock',v_new)||CASE WHEN v_old<>v_new THEN jsonb_build_object('stock_revision',v_stock_rev+1) ELSE '{}'::jsonb END);
 v_cursor:=v_cursor+1;
 v_result:=jsonb_build_object(
   'commit_protocol','r155','status','committed','event_id',v_id,
   'batch_id',v_batch,'product_id',v_pid,'barcode',v_barcode,
   'before',v_old,'after',v_new,'delta',v_new-v_old,
   'snapshot_revision',v_cursor,'stock_revision',CASE WHEN v_old<>v_new THEN v_stock_rev+1 ELSE v_stock_rev END,'stock_changed',v_old<>v_new);
 UPDATE public.pos7_owner_commands
 SET status='processed',result=v_result,processed_at=now()
 WHERE store_id='pos7' AND event_id=v_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ack_conflict'; END IF;

   v_results:=v_results||jsonb_build_array(v_result||jsonb_build_object('replayed',false));
 END LOOP;
 UPDATE public.pos7_owner_snapshot
 SET sections=jsonb_set(v_snapshot.sections,'{products}',v_catalog||v_changes,false),revision=v_cursor,updated_at=now()
 WHERE store_id='pos7' AND revision=v_snapshot.revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'inventory_snapshot_conflict'; END IF;
 RETURN jsonb_build_object('protocol','r254_atomic','status','committed','batch_id',v_batch,'count',v_count,'items',v_results);
END $function$
