-- TAB 2 ONLY: rmskuolsiqbzxuakofpb. Additive API; do not run on Tab 1.
-- No inventory or financial records change when these functions are installed.
-- Test against isolated fixtures before deployment. No blanket revision reset.
CREATE OR REPLACE FUNCTION public.pos7_inventory_prepare_tab2_r345(p_event_id uuid,p_device text,p_product_id text,p_barcode text,p_counted bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g record; s record; c record; prod jsonb; pid text; n integer; original jsonb; revised jsonb; norm text; v_stock bigint; v_rev bigint;
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true THEN RAISE EXCEPTION 'r345_owner_required'; END IF;
 IF EXISTS (SELECT 1 FROM public.pos7_store2_clone_guard_r218 WHERE store_id='pos7' AND blocked) THEN RAISE EXCEPTION 'r345_store2_blocked'; END IF;
 IF p_device IS NULL OR length(p_device)<8 THEN RAISE EXCEPTION 'r345_device_required'; END IF;
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR g.enabled IS DISTINCT FROM true OR g.approved_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'r345_gate_disabled'; END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR s.publisher_device IS DISTINCT FROM p_device OR jsonb_typeof(s.sections->'products') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'r345_publisher_mismatch'; END IF;
 SELECT * INTO c FROM public.pos7_owner_commands WHERE store_id='pos7' AND event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR c.status IS DISTINCT FROM 'pending' OR c.event_type IS DISTINCT FROM 'inventory_count' OR c.device_id IS NULL OR c.device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'r345_invalid_pending_command'; END IF;
 original:=coalesce(c.payload->'r340_original',c.payload);
 IF original->>'source' IS DISTINCT FROM 'owner_phone_inventory' OR original->>'requires_tablet_validation' IS DISTINCT FROM 'true' OR coalesce(length(original->>'batch_id'),0) NOT BETWEEN 4 AND 128 OR original->>'batch_id' IN ('INV-R152-TEST-001','INV-mwfb3jy6-fhbbwn9e') OR p_barcode IS NULL OR btrim(p_barcode)='' OR original->>'barcode' IS DISTINCT FROM p_barcode OR p_counted IS NULL OR p_counted<0 OR p_counted>9007199254740991 OR original->'counted_qty' IS DISTINCT FROM to_jsonb(p_counted) OR c.payload->'counted_qty' IS DISTINCT FROM to_jsonb(p_counted) THEN RAISE EXCEPTION 'r345_confirmation_changed'; END IF;
 -- Exact barcode takes precedence; otherwise normalize digit scripts and leading zeros only for numeric barcodes.
 SELECT count(*),min(key) INTO n,pid FROM jsonb_each(s.sections->'products') WHERE value->>'barcode'=p_barcode;
 IF n=0 THEN
   norm:=translate(btrim(p_barcode),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
   IF norm ~ '^[0-9]+$' THEN
     SELECT count(*),min(key) INTO n,pid FROM jsonb_each(s.sections->'products')
     WHERE translate(btrim(value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789') ~ '^[0-9]+$'
       AND coalesce(nullif(ltrim(translate(btrim(value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'0'),''),'0')=coalesce(nullif(ltrim(norm,'0'),''),'0');
   END IF;
 END IF;
 IF n<>1 OR pid IS DISTINCT FROM p_product_id OR pid IS DISTINCT FROM original->>'product_id' THEN RETURN jsonb_build_object('status','review','reason','هوية باركود ملتبسة أو غير موجودة'); END IF;
 prod:=s.sections->'products'->pid;
 IF prod->>'id' IS DISTINCT FROM pid OR jsonb_typeof(prod->'stock') IS DISTINCT FROM 'number' OR coalesce(prod->>'stock','') !~ '^-?(0|[1-9][0-9]*)([.]0+)?$' OR length(prod->>'stock')>32 OR coalesce(prod->>'stock_revision','') !~ '^(0|[1-9][0-9]{0,14})$' OR prod->>'stock_revision_untrusted'='true' THEN RETURN jsonb_build_object('status','review','reason','مراجعة المخزون غير موثوقة'); END IF;
 IF abs((prod->>'stock')::numeric)>9007199254740991 THEN RETURN jsonb_build_object('status','review','reason','كمية غير صالحة'); END IF;
 v_stock:=(prod->>'stock')::numeric::bigint; v_rev:=(prod->>'stock_revision')::bigint;
 revised:=c.payload||jsonb_build_object('product_id',pid,'barcode',prod->>'barcode','baseline_qty',v_stock,'stock_revision',v_rev,'r340_original',original,'r340_confirmed_at',now(),'r340_device',p_device);
 UPDATE public.pos7_owner_commands SET payload=revised WHERE event_id=p_event_id AND store_id='pos7' AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'r345_pending_changed'; END IF;
 RETURN jsonb_build_object('status','prepared','payload',revised,'product',prod,'revision',s.revision);
END $fn$;
REVOKE ALL ON FUNCTION public.pos7_inventory_prepare_tab2_r345(uuid,text,text,text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_prepare_tab2_r345(uuid,text,text,text,bigint) TO authenticated;

-- Repair missing/untrusted revision metadata ONLY with evidence supplied by the authoritative Tab2.
-- Local stock, barcode and ID must exactly equal current cloud values; no pending or historical inventory commands.
-- Historical events and ambiguous SKUs remain for manual review. An unchanged cloud product is never re-numbered.
CREATE OR REPLACE FUNCTION public.pos7_inventory_repair_revisions_tab2_r345(p_device text,p_expected bigint,p_products jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g record; s record; e jsonb; p jsonb; pid text; bc text; norm text; stock bigint; nr bigint; lr bigint; cr bigint; patched jsonb; done jsonb:='{}'::jsonb; skipped jsonb:='{}'::jsonb; matches integer;
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true THEN RAISE EXCEPTION 'r345_owner_required'; END IF;
 IF EXISTS (SELECT 1 FROM public.pos7_store2_clone_guard_r218 WHERE store_id='pos7' AND blocked) THEN RAISE EXCEPTION 'r345_store2_blocked'; END IF;
 IF p_device IS NULL OR length(p_device)<8 OR p_expected IS NULL OR jsonb_typeof(p_products) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'r345_bad_repair_request'; END IF;
 IF jsonb_array_length(p_products)>500 THEN RAISE EXCEPTION 'r345_repair_limit'; END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_products) x)<>jsonb_array_length(p_products) THEN RAISE EXCEPTION 'r345_duplicate_repair_ids'; END IF;
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR g.enabled IS DISTINCT FROM true OR g.approved_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'r345_gate_disabled'; END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR s.publisher_device IS DISTINCT FROM p_device OR s.revision IS DISTINCT FROM p_expected OR s.revision>=9007199254740990 OR jsonb_typeof(s.sections->'products') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'r345_snapshot_changed'; END IF;
 patched:=s.sections;
 FOR e IN SELECT value FROM jsonb_array_elements(p_products) LOOP
   pid:=e->>'id';bc:=e->>'barcode';p:=s.sections->'products'->pid;
   IF pid IS NULL OR pid='' OR bc IS NULL OR btrim(bc)='' OR p->>'id' IS DISTINCT FROM pid OR p->>'barcode' IS DISTINCT FROM bc OR jsonb_typeof(p->'stock') IS DISTINCT FROM 'number' OR jsonb_typeof(e->'stock') IS DISTINCT FROM 'number' OR coalesce(p->>'stock','') !~ '^-?(0|[1-9][0-9]*)([.]0+)?$' OR coalesce(e->>'stock','') !~ '^-?(0|[1-9][0-9]*)([.]0+)?$' OR length(p->>'stock')>32 OR length(e->>'stock')>32 THEN skipped:=skipped||jsonb_build_object(pid,'identity_or_stock_invalid');CONTINUE; END IF;
   IF (p->>'stock')::numeric IS DISTINCT FROM (e->>'stock')::numeric OR abs((p->>'stock')::numeric)>9007199254740991 THEN skipped:=skipped||jsonb_build_object(pid,'local_cloud_quantity_differs');CONTINUE; END IF;
   IF coalesce(p->>'stock_revision','') ~ '^(0|[1-9][0-9]{0,14})$' AND p->>'stock_revision_untrusted' IS DISTINCT FROM 'true' THEN skipped:=skipped||jsonb_build_object(pid,'already_trusted');CONTINUE; END IF;
   norm:=translate(btrim(bc),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
   IF norm ~ '^[0-9]+$' THEN
     SELECT count(*) INTO matches FROM jsonb_each(s.sections->'products') x WHERE translate(btrim(x.value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789') ~ '^[0-9]+$' AND coalesce(nullif(ltrim(translate(btrim(x.value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'0'),''),'0')=coalesce(nullif(ltrim(norm,'0'),''),'0');
   ELSE SELECT count(*) INTO matches FROM jsonb_each(s.sections->'products') x WHERE x.value->>'barcode'=bc; END IF;
   IF matches<>1 THEN skipped:=skipped||jsonb_build_object(pid,'ambiguous_barcode');CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM public.pos7_owner_commands c WHERE c.store_id='pos7' AND c.event_type='inventory_count' AND c.status IN ('pending','processed') AND (c.payload->>'product_id'=pid OR c.result->>'product_id'=pid OR c.payload->>'barcode'=bc)) THEN skipped:=skipped||jsonb_build_object(pid,'inventory_history_requires_review');CONTINUE; END IF;
   IF e->>'stock_revision' IS NOT NULL AND e->>'stock_revision' !~ '^(0|[1-9][0-9]{0,14})$' THEN skipped:=skipped||jsonb_build_object(pid,'invalid_local_revision');CONTINUE; END IF;
   lr:=coalesce((e->>'stock_revision')::bigint,0);cr:=CASE WHEN coalesce(p->>'stock_revision','') ~ '^(0|[1-9][0-9]{0,14})$' THEN (p->>'stock_revision')::bigint ELSE 0 END;
   nr:=greatest(lr,cr)+1;
   IF nr>999999999999999 THEN skipped:=skipped||jsonb_build_object(pid,'revision_overflow');CONTINUE; END IF;
   patched:=jsonb_set(patched,ARRAY['products',pid,'stock_revision'],to_jsonb(nr),true);
   patched:=jsonb_set(patched,ARRAY['products',pid,'stock_revision_untrusted'],'false'::jsonb,true);
   done:=done||jsonb_build_object(pid,nr);
 END LOOP;
 IF done<>'{}'::jsonb THEN
   UPDATE public.pos7_owner_snapshot SET sections=patched,revision=s.revision+1,updated_at=clock_timestamp() WHERE store_id='pos7' AND revision=s.revision;
   IF NOT FOUND THEN RAISE EXCEPTION 'r345_snapshot_changed'; END IF;
 END IF;
 RETURN jsonb_build_object('status','ok','repaired',done,'skipped',skipped,'revision',s.revision+CASE WHEN done<>'{}'::jsonb THEN 1 ELSE 0 END);
END $fn$;
REVOKE ALL ON FUNCTION public.pos7_inventory_repair_revisions_tab2_r345(text,bigint,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_repair_revisions_tab2_r345(text,bigint,jsonb) TO authenticated;
