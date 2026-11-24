CREATE OR REPLACE FUNCTION public.pos7_inventory_prepare_r340(p_event_id uuid,p_device text,p_product_id text,p_barcode text,p_counted bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE g record; s record; c record; prod jsonb; pid text; n integer; original jsonb; revised jsonb;
BEGIN
 IF NOT public.pos7_is_member('pos7',ARRAY['owner']) THEN RAISE EXCEPTION 'inventory_owner_required'; END IF;
 SELECT * INTO g FROM pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR NOT g.enabled OR g.approved_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'inventory_gate_disabled'; END IF;
 SELECT * INTO s FROM pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR s.publisher_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'inventory_publisher_device_mismatch'; END IF;
 SELECT * INTO c FROM pos7_owner_commands WHERE store_id='pos7' AND event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'pending' OR c.event_type<>'inventory_count' THEN RAISE EXCEPTION 'inventory_command_not_pending'; END IF;
 IF c.payload->>'source' IS DISTINCT FROM 'owner_phone_inventory' OR c.payload->>'requires_tablet_validation' IS DISTINCT FROM 'true' OR c.payload->>'batch_id' IN ('INV-R152-TEST-001','INV-mwfb3jy6-fhbbwn9e') THEN RAISE EXCEPTION 'inventory_payload_invalid'; END IF;
 IF p_barcode IS NULL OR btrim(p_barcode)='' OR p_barcode IS DISTINCT FROM c.payload->>'barcode' OR p_counted IS NULL OR p_counted<0 OR p_counted>9007199254740991 OR to_jsonb(p_counted) IS DISTINCT FROM c.payload->'counted_qty' THEN RAISE EXCEPTION 'inventory_confirmation_changed'; END IF;
 SELECT count(*),min(key) INTO n,pid FROM jsonb_each(s.sections->'products') WHERE value->>'barcode'=p_barcode;
 IF n<>1 OR pid IS DISTINCT FROM p_product_id THEN RETURN jsonb_build_object('status','review','reason','الباركود غير موجود أو مكرر؛ استُبعد هذا الصنف فقط'); END IF;
 prod:=s.sections->'products'->pid;
 IF prod->>'id' IS DISTINCT FROM pid OR jsonb_typeof(prod->'stock') IS DISTINCT FROM 'number' OR coalesce(prod->>'stock','') !~ '^-?(0|[1-9][0-9]*)$' OR abs((prod->>'stock')::numeric)>9007199254740991 OR coalesce(prod->>'stock_revision','') !~ '^(0|[1-9][0-9]*)$' OR (prod->>'stock_revision')::numeric>=9007199254740990 OR prod->>'stock_revision_untrusted'='true' THEN RETURN jsonb_build_object('status','review','reason','بيانات الصنف السحابي تحتاج مراجعة'); END IF;
 original:=coalesce(c.payload->'r340_original',c.payload);
 revised:=c.payload||jsonb_build_object('product_id',pid,'baseline_qty',prod->'stock','stock_revision',prod->'stock_revision','r340_original',original,'r340_confirmed_at',now(),'r340_device',p_device);
 UPDATE pos7_owner_commands SET payload=revised WHERE event_id=p_event_id AND store_id='pos7';
 RETURN jsonb_build_object('status','prepared','payload',revised,'product',prod,'revision',s.revision);
END $$;
REVOKE ALL ON FUNCTION public.pos7_inventory_prepare_r340(uuid,text,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_prepare_r340(uuid,text,text,text,bigint) TO authenticated;
