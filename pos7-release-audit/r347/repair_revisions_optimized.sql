CREATE OR REPLACE FUNCTION public.pos7_inventory_repair_revisions_tab2_r345(p_device text, p_expected bigint, p_products jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g record; s record; e jsonb; p jsonb; pid text; bc text; norm text; stock bigint; nr bigint; lr bigint; cr bigint; patched jsonb; done jsonb:='{}'::jsonb; skipped jsonb:='{}'::jsonb; matches integer; products jsonb; numeric_counts jsonb; exact_counts jsonb; changes jsonb:='{}'::jsonb;
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
 products:=s.sections->'products';
 SELECT coalesce(jsonb_object_agg(barcode,n),'{}'::jsonb) INTO exact_counts FROM
 (SELECT value->>'barcode' AS barcode,count(*) n FROM jsonb_each(products) WHERE value->>'barcode' IS NOT NULL GROUP BY 1) a;
 SELECT coalesce(jsonb_object_agg(normkey,n),'{}'::jsonb) INTO numeric_counts FROM
 (SELECT coalesce(nullif(ltrim(b,'0'),''),'0') normkey,count(*) n FROM
 (SELECT translate(btrim(value->>'barcode'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789') b FROM jsonb_each(products)) a
 WHERE b ~ '^[0-9]+$' GROUP BY 1) b;
 FOR e IN SELECT value FROM jsonb_array_elements(p_products) LOOP
   pid:=e->>'id';bc:=e->>'barcode';p:=products->pid;
   IF pid IS NULL OR pid='' OR bc IS NULL OR btrim(bc)='' OR p->>'id' IS DISTINCT FROM pid OR p->>'barcode' IS DISTINCT FROM bc OR jsonb_typeof(p->'stock') IS DISTINCT FROM 'number' OR jsonb_typeof(e->'stock') IS DISTINCT FROM 'number' OR coalesce(p->>'stock','') !~ '^-?(0|[1-9][0-9]*)([.]0+)?$' OR coalesce(e->>'stock','') !~ '^-?(0|[1-9][0-9]*)([.]0+)?$' OR length(p->>'stock')>32 OR length(e->>'stock')>32 THEN skipped:=skipped||jsonb_build_object(pid,'identity_or_stock_invalid');CONTINUE; END IF;
   IF (p->>'stock')::numeric IS DISTINCT FROM (e->>'stock')::numeric OR abs((p->>'stock')::numeric)>9007199254740991 THEN skipped:=skipped||jsonb_build_object(pid,'local_cloud_quantity_differs');CONTINUE; END IF;
   IF coalesce(p->>'stock_revision','') ~ '^(0|[1-9][0-9]{0,14})$' AND p->>'stock_revision_untrusted' IS DISTINCT FROM 'true' THEN skipped:=skipped||jsonb_build_object(pid,'already_trusted');CONTINUE; END IF;
   norm:=translate(btrim(bc),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
   IF norm ~ '^[0-9]+$' THEN
     matches:=coalesce((numeric_counts->>coalesce(nullif(ltrim(norm,'0'),''),'0'))::integer,0);
   ELSE matches:=coalesce((exact_counts->>bc)::integer,0); END IF;
   IF matches<>1 THEN skipped:=skipped||jsonb_build_object(pid,'ambiguous_barcode');CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM public.pos7_owner_commands c WHERE c.store_id='pos7' AND c.event_type='inventory_count' AND c.status IN ('pending','processed') AND (c.payload->>'product_id'=pid OR c.result->>'product_id'=pid OR c.payload->>'barcode'=bc)) THEN skipped:=skipped||jsonb_build_object(pid,'inventory_history_requires_review');CONTINUE; END IF;
   IF e->>'stock_revision' IS NOT NULL AND e->>'stock_revision' !~ '^(0|[1-9][0-9]{0,14})$' THEN skipped:=skipped||jsonb_build_object(pid,'invalid_local_revision');CONTINUE; END IF;
   lr:=coalesce((e->>'stock_revision')::bigint,0);cr:=CASE WHEN coalesce(p->>'stock_revision','') ~ '^(0|[1-9][0-9]{0,14})$' THEN (p->>'stock_revision')::bigint ELSE 0 END;
   nr:=greatest(lr,cr)+1;
   IF nr>999999999999999 THEN skipped:=skipped||jsonb_build_object(pid,'revision_overflow');CONTINUE; END IF;
   changes:=changes||jsonb_build_object(pid,p||jsonb_build_object('stock_revision',nr,'stock_revision_untrusted',false));
   done:=done||jsonb_build_object(pid,nr);
 END LOOP;
 IF done<>'{}'::jsonb THEN
   patched:=jsonb_set(s.sections,'{products}',products||changes,false);
   UPDATE public.pos7_owner_snapshot SET sections=patched,revision=s.revision+1,updated_at=clock_timestamp() WHERE store_id='pos7' AND revision=s.revision;
   IF NOT FOUND THEN RAISE EXCEPTION 'r345_snapshot_changed'; END IF;
 END IF;
 RETURN jsonb_build_object('status','ok','repaired',done,'skipped',skipped,'revision',s.revision+CASE WHEN done<>'{}'::jsonb THEN 1 ELSE 0 END);
END $function$
