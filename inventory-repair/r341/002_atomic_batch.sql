-- POS7 R341: additive atomic wrapper. All calls to existing R155 share one database transaction.
-- No legacy function, ACL, invoice, stock, or inventory command is overwritten by this migration.
CREATE OR REPLACE FUNCTION public.pos7_inventory_commit_batch_atomic_r341(
  p_ids uuid[],p_device text,p_verified_tablet_stock boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_id uuid; v_result jsonb; v_out jsonb:='[]'::jsonb; v_count int;
  v_cmd record; v_products text[]:=ARRAY[]::text[];
BEGIN
  IF NOT public.pos7_is_member('pos7',ARRAY['owner']) THEN
    RAISE EXCEPTION 'inventory_owner_required';
  END IF;
  IF p_verified_tablet_stock IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'tablet_stock_confirmation_required';
  END IF;
  IF p_device IS NULL OR length(p_device)<8 THEN RAISE EXCEPTION 'invalid_approving_device'; END IF;
  v_count:=coalesce(array_length(p_ids,1),0);
  IF v_count<1 OR v_count>30 THEN RAISE EXCEPTION 'inventory_batch_limit_1_to_30'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>v_count THEN
    RAISE EXCEPTION 'inventory_duplicate_events';
  END IF;
  -- Verify the entire batch before any write, including product-level idempotency.
  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT status,event_type,payload,result INTO v_cmd
    FROM public.pos7_owner_commands
    WHERE store_id='pos7' AND event_id=v_id;
    IF NOT FOUND OR v_cmd.event_type IS DISTINCT FROM 'inventory_count' THEN
      RAISE EXCEPTION 'inventory_event_missing_or_wrong_store';
    END IF;
    IF v_cmd.status NOT IN ('pending','processed') THEN
      RAISE EXCEPTION 'inventory_event_not_pending_or_processed';
    END IF;
    IF v_cmd.status='processed' AND
       (v_cmd.result->>'commit_protocol' IS DISTINCT FROM 'r155'
       OR v_cmd.result->>'event_id' IS DISTINCT FROM v_id::text) THEN
       RAISE EXCEPTION 'inventory_processed_by_other_protocol';
    END IF;
    IF v_cmd.payload->>'product_id'=ANY(v_products) THEN
      RAISE EXCEPTION 'duplicate_product_in_single_batch';
    END IF;
    v_products:=array_append(v_products,v_cmd.payload->>'product_id');
  END LOOP;
  -- No per-item EXCEPTION handler: any failed R155 rolls back ALL snapshot changes and acknowledgements.
  FOREACH v_id IN ARRAY p_ids LOOP
    v_result:=public.pos7_inventory_commit_r155(v_id,p_device);
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'event_id',v_id,'replayed',v_result->'replayed','result',v_result));
  END LOOP;
  RETURN jsonb_build_object('status','committed','count',v_count,'items',v_out);
END;
$$;
REVOKE ALL ON FUNCTION public.pos7_inventory_commit_batch_atomic_r341(uuid[],text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_commit_batch_atomic_r341(uuid[],text,boolean) TO authenticated;
