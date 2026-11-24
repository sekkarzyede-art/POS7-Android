-- R346: record an explicitly confirmed review without touching inventory or financial data.
CREATE OR REPLACE FUNCTION public.pos7_inventory_mark_review_r346(p_event_id uuid,p_device text,p_original jsonb,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g record; s record; c record; original jsonb; outcome jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true THEN RAISE EXCEPTION 'r346_owner_required'; END IF;
 IF EXISTS (SELECT 1 FROM public.pos7_store2_clone_guard_r218 WHERE store_id='pos7' AND blocked) THEN RAISE EXCEPTION 'r346_store2_blocked'; END IF;
 IF p_event_id IS NULL OR p_device IS NULL OR length(p_device)<8 OR length(p_device)>128 OR jsonb_typeof(p_original) IS DISTINCT FROM 'object' OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'r346_invalid_review_request'; END IF;
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR g.enabled IS DISTINCT FROM true OR g.approved_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'r346_gate_disabled'; END IF;
 SELECT publisher_device INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR s.publisher_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'r346_publisher_mismatch'; END IF;
 SELECT * INTO c FROM public.pos7_owner_commands WHERE store_id='pos7' AND event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR c.event_type IS DISTINCT FROM 'inventory_count' OR c.device_id IS NULL OR c.device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'r346_invalid_command'; END IF;
 original:=coalesce(c.payload->'r340_original',c.payload);
 IF original IS DISTINCT FROM p_original OR original->>'source' IS DISTINCT FROM 'owner_phone_inventory' OR original->>'requires_tablet_validation' IS DISTINCT FROM 'true' OR coalesce(length(original->>'batch_id'),0) NOT BETWEEN 4 AND 128 OR original->>'batch_id' IN ('INV-R152-TEST-001','INV-mwfb3jy6-fhbbwn9e') OR original->>'batch_id' IS DISTINCT FROM c.payload->>'batch_id' OR original->'counted_qty' IS DISTINCT FROM c.payload->'counted_qty' THEN RAISE EXCEPTION 'r346_confirmation_mismatch'; END IF;
 IF c.status='rejected' AND c.result->>'review_protocol'='r346' AND c.result->>'status'='review' AND c.result->>'event_id'=p_event_id::text AND c.result->>'batch_id'=original->>'batch_id' THEN RETURN c.result; END IF;
 IF c.status IS DISTINCT FROM 'pending' OR c.result->>'commit_protocol' IS NOT NULL OR c.result->>'status'='committed' THEN RAISE EXCEPTION 'r346_command_not_pending'; END IF;
 outcome:=jsonb_build_object('review_protocol','r346','status','review','event_id',p_event_id,'batch_id',original->>'batch_id','product_id',original->>'product_id','barcode',original->>'barcode','counted_qty',original->'counted_qty','reason',btrim(p_reason),'reviewed_at',clock_timestamp(),'reviewed_by_device',p_device);
 UPDATE public.pos7_owner_commands SET status='rejected',result=outcome,processed_at=clock_timestamp() WHERE event_id=p_event_id AND store_id='pos7' AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'r346_review_conflict'; END IF;
 RETURN outcome;
END $fn$;
REVOKE ALL ON FUNCTION public.pos7_inventory_mark_review_r346(uuid,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_mark_review_r346(uuid,text,jsonb,text) TO authenticated;
