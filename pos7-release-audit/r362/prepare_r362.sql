-- Store2-only. Initialize missing/untrusted revision metadata on explicit, pending,
-- tablet-confirmed inventory count. Never change quantity here; R254 remains atomic.
CREATE OR REPLACE FUNCTION public.pos7_inventory_prepare_tab2_r362(
 p_event_id uuid,p_device text,p_product_id text,p_barcode text,p_counted bigint,
 p_local_stock bigint,p_local_revision bigint,p_cloud_stock bigint,p_cloud_revision bigint,p_cloud_untrusted boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE g record;s record;c record;prod jsonb;orig jsonb;res jsonb;n integer;norm text;old_rev bigint;hist_rev bigint;seed bigint; v_stock bigint; newprod jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.pos7_is_member('pos7',ARRAY['owner']) IS DISTINCT FROM true THEN RAISE EXCEPTION 'r362_owner_required'; END IF;
 IF EXISTS(SELECT 1 FROM public.pos7_store2_clone_guard_r218 WHERE store_id='pos7' AND blocked) THEN RAISE EXCEPTION 'r362_store2_blocked'; END IF;
 IF p_device IS NULL OR length(p_device)<8 OR p_event_id IS NULL OR p_product_id IS NULL OR p_product_id !~ '^[1-9][0-9]{0,15}$' OR p_product_id::numeric>9007199254740991 OR p_barcode IS NULL OR btrim(p_barcode)='' OR p_counted IS NULL OR p_counted<0 OR p_counted>9007199254740991 OR p_local_stock IS NULL OR p_local_stock NOT BETWEEN -9007199254740991 AND 9007199254740991 OR p_cloud_stock IS NULL OR p_cloud_stock NOT BETWEEN -9007199254740991 AND 9007199254740991 OR (p_local_revision IS NOT NULL AND p_local_revision NOT BETWEEN 0 AND 999999999999998) OR (p_cloud_revision IS NOT NULL AND p_cloud_revision NOT BETWEEN 0 AND 999999999999998) OR p_cloud_untrusted IS NULL THEN RAISE EXCEPTION 'r362_invalid_proof'; END IF;
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR g.enabled IS DISTINCT FROM true OR g.approved_device IS DISTINCT FROM p_device THEN RAISE EXCEPTION 'r362_gate_disabled'; END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 IF NOT FOUND OR s.publisher_device IS DISTINCT FROM p_device OR s.revision>=9007199254740990 OR jsonb_typeof(s.sections->'products') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'r362_publisher_mismatch'; END IF;
 SELECT * INTO c FROM public.pos7_owner_commands WHERE store_id='pos7' AND event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR c.status IS DISTINCT FROM 'pending' OR c.event_type IS DISTINCT FROM 'inventory_count' OR c.device_id IS NULL OR c.device_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'r362_pending_required'; END IF;
 orig:=coalesce(c.payload->'r340_original',c.payload);
 IF orig->>'source' IS DISTINCT FROM 'owner_phone_inventory' OR orig->>'requires_tablet_validation' IS DISTINCT FROM 'true' OR coalesce(length(orig->>'batch_id'),0) NOT BETWEEN 4 AND 128 OR orig->>'batch_id' IN ('INV-R152-TEST-001','INV-mwfb3jy6-fhbbwn9e') OR orig->>'product_id' IS DISTINCT FROM p_product_id OR orig->>'barcode' IS DISTINCT FROM p_barcode OR orig->'counted_qty' IS DISTINCT FROM to_jsonb(p_counted) OR c.payload->'counted_qty' IS DISTINCT FROM to_jsonb(p_counted) THEN RAISE EXCEPTION 'r362_confirmation_changed'; END IF;
 prod:=s.sections->'products'->p_product_id;
 IF prod->>'id' IS DISTINCT FROM p_product_id OR prod->>'barcode' IS DISTINCT FROM p_barcode OR jsonb_typeof(prod->'stock') IS DISTINCT FROM 'number' OR coalesce(prod->>'stock','') !~ '^-?(0|[1-9][0-9]*)([.]0+)?$' OR length(prod->>'stock')>32 THEN RETURN jsonb_build_object('status','review','reason','هوية أو كمية غير صالحة'); END IF;
 IF (prod->>'stock')::numeric NOT BETWEEN -9007199254740991 AND 9007199254740991 THEN RETURN jsonb_build_object('status','review','reason','كمية غير صالحة'); END IF;
 v_stock:=(prod->>'stock')::numeric::bigint;
 IF prod->>'stock_revision' IS NOT NULL AND coalesce(prod->>'stock_revision','') !~ '^(0|[1-9][0-9]{0,14})$' THEN RETURN jsonb_build_object('status','review','reason','رقم مراجعة غير صالح'); END IF;
 old_rev:=(prod->>'stock_revision')::bigint;
 IF v_stock IS DISTINCT FROM p_cloud_stock OR old_rev IS DISTINCT FROM p_cloud_revision OR coalesce(prod->>'stock_revision_untrusted'='true',false) IS DISTINCT FROM p_cloud_untrusted THEN RAISE EXCEPTION 'r362_snapshot_changed'; END IF;
 -- Existing trusted path must never be overwritten/reseeded by this RPC.
 IF old_rev IS NOT NULL AND NOT p_cloud_untrusted THEN RETURN public.pos7_inventory_prepare_tab2_r345(p_event_id,p_device,p_product_id,p_barcode,p_counted); END IF;
 SELECT count(*) INTO n FROM jsonb_each(s.sections->'products') WHERE value->>'id'=p_product_id;
 IF n<>1 THEN RETURN jsonb_build_object('status','review','reason','معرف غير فريد'); END IF;
 norm:=translate(btrim(p_barcode),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
 IF norm ~ '^[0-9]+$' THEN
  SELECT count(*) INTO n FROM jsonb_each(s.sections->'products') WHERE translate(btrim(value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789') ~ '^[0-9]+$' AND coalesce(nullif(ltrim(translate(btrim(value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'0'),''),'0')=coalesce(nullif(ltrim(norm,'0'),''),'0');
 ELSE SELECT count(*) INTO n FROM jsonb_each(s.sections->'products') WHERE value->>'barcode'=p_barcode; END IF;
 IF n<>1 THEN RETURN jsonb_build_object('status','review','reason','باركود ملتبس'); END IF;
 IF EXISTS(SELECT 1 FROM public.pos7_owner_commands x WHERE x.store_id='pos7' AND x.event_type='inventory_count' AND x.status='pending' AND x.event_id<>p_event_id AND (x.payload->>'product_id'=p_product_id OR x.payload->>'barcode'=p_barcode)) THEN RETURN jsonb_build_object('status','review','reason','طلب مكرر معلق'); END IF;
 -- Do not invent a revision lower than a prior committed inventory event.
 IF EXISTS(SELECT 1 FROM public.pos7_owner_commands x WHERE x.store_id='pos7' AND x.event_type='inventory_count' AND x.status='processed' AND (x.payload->>'product_id'=p_product_id OR x.result->>'product_id'=p_product_id OR x.payload->>'barcode'=p_barcode) AND (x.result->>'status' IS DISTINCT FROM 'committed' OR x.result->>'product_id' IS DISTINCT FROM p_product_id OR x.result->>'barcode' IS DISTINCT FROM p_barcode OR coalesce(x.result->>'stock_revision','') !~ '^(0|[1-9][0-9]{0,14})$')) THEN RETURN jsonb_build_object('status','review','reason','سجل مراجعة سابق ملتبس'); END IF;
 SELECT max((x.result->>'stock_revision')::bigint) INTO hist_rev FROM public.pos7_owner_commands x WHERE x.store_id='pos7' AND x.event_type='inventory_count' AND x.status='processed' AND x.result->>'product_id'=p_product_id AND x.result->>'barcode'=p_barcode AND x.result->>'status'='committed' AND coalesce(x.result->>'stock_revision','') ~ '^(0|[1-9][0-9]{0,14})$';
 seed:=greatest(coalesce(old_rev,-1),coalesce(p_local_revision,-1),coalesce(hist_rev,-1))+1;
 IF seed>999999999999998 THEN RETURN jsonb_build_object('status','review','reason','رقم مراجعة خارج الحد'); END IF;
 newprod:=prod||jsonb_build_object('stock_revision',seed,'stock_revision_untrusted',false);
 UPDATE public.pos7_owner_snapshot SET sections=jsonb_set(s.sections,ARRAY['products',p_product_id],newprod,false),revision=s.revision+1,updated_at=clock_timestamp() WHERE store_id='pos7' AND revision=s.revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'r362_snapshot_changed'; END IF;
 res:=public.pos7_inventory_prepare_tab2_r345(p_event_id,p_device,p_product_id,p_barcode,p_counted);
 IF res->>'status' IS DISTINCT FROM 'prepared' THEN RAISE EXCEPTION 'r362_prepare_failed'; END IF;
 RETURN res||jsonb_build_object('r362_seeded',true,'r362_seed_revision',seed);
END $function$;
REVOKE ALL ON FUNCTION public.pos7_inventory_prepare_tab2_r362(uuid,text,text,text,bigint,bigint,bigint,bigint,bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos7_inventory_prepare_tab2_r362(uuid,text,text,text,bigint,bigint,bigint,bigint,bigint,boolean) TO authenticated;
