CREATE OR REPLACE FUNCTION public.pos7_inventory_commit_batch_r254(p_ids uuid[], p_device text, p_verified_tablet_stock boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_count integer; v_batch text; v_item record; v_gate record; v_snapshot record;
 v_id uuid; v_result jsonb; v_results jsonb := '[]'::jsonb;
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
   IF v_snapshot.sections->'products'->(v_item.payload->>'product_id')->>'barcode'
     IS DISTINCT FROM v_item.payload->>'barcode' THEN RAISE EXCEPTION 'inventory_batch_barcode_mismatch'; END IF;
   IF (v_snapshot.sections->'products'->(v_item.payload->>'product_id')->>'stock')::numeric
      IS DISTINCT FROM (v_item.payload->>'baseline_qty')::numeric THEN RAISE EXCEPTION 'inventory_batch_stock_changed'; END IF;
   IF (v_snapshot.sections->'products'->(v_item.payload->>'product_id')->>'stock_revision')
      IS DISTINCT FROM v_item.payload->>'stock_revision' THEN RAISE EXCEPTION 'inventory_batch_revision_changed'; END IF;
 END LOOP;
 FOREACH v_id IN ARRAY p_ids LOOP
   v_result:=public.pos7_inventory_commit_r155(v_id,p_device);
   IF v_result->>'status' IS DISTINCT FROM 'committed' OR v_result->>'replayed' IS DISTINCT FROM 'false' THEN
     RAISE EXCEPTION 'inventory_batch_commit_unconfirmed';
   END IF;
   v_results:=v_results||jsonb_build_array(v_result);
 END LOOP;
 RETURN jsonb_build_object('protocol','r254_atomic','status','committed','batch_id',v_batch,'count',v_count,'items',v_results);
END $function$
