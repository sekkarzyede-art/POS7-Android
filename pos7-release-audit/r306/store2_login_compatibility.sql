CREATE OR REPLACE FUNCTION public.pos7_store2_first_tablet_r215(p_device text, p_activate boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  current_snapshot public.pos7_owner_snapshot%rowtype;
  cas_sql text;
  verified_cas boolean;
  may_transfer boolean;
  bound boolean := false;
begin
  if auth.uid() is null or not public.pos7_is_member('pos7', array['owner']) then
    raise exception 'owner_authentication_required' using errcode='42501';
  end if;
  if p_device is null or length(p_device) not between 8 and 128
     or p_device !~ '^[A-Za-z0-9_.-]+$' then
    raise exception 'invalid_tablet_device_id' using errcode='22023';
  end if;
  select pg_get_functiondef('public.pos7_owner_publish(jsonb,bigint,text)'::regprocedure)
  into cas_sql;
  verified_cas :=
    (position('inventory_stale_stock_revision' in coalesce(cas_sql,''))>0
     OR md5(cas_sql)='446e855d60ae9e3692bff0820ed318ac')
    and position('inventory_new_product_revision_invalid' in coalesce(cas_sql,''))>0
    and position('inventory_revision_without_stock' in coalesce(cas_sql,''))>0;
  select * into current_snapshot from public.pos7_owner_snapshot
    where store_id='pos7' for update;
  if not found then
    raise exception 'store2_snapshot_missing';
  end if;
  bound := current_snapshot.publisher_device=p_device;
  may_transfer :=
    not bound
    and current_snapshot.publisher_device like 'store2-tab-%'
    and current_snapshot.revision=0
    and current_snapshot.sections='{}'::jsonb
    and not exists (select 1 from public.pos7_owner_commands where store_id='pos7')
    and not exists (select 1 from public.pos7_mobile_events where store_id='pos7')
    and not exists (select 1 from public.pos7_product_catalog where store_id='pos7')
    and not exists (select 1 from public.pos7_product_images where store_id='pos7')
    and not exists (select 1 from public.pos7_inventory_gate_r152 where store_id='pos7' and enabled=true)
    and exists (select 1 from public.pos7_store_setup where store_id='pos7' and setup_status='configuring');
  -- Log a candidate during authenticated preflight without binding any device.
  if (p_activate is false) and may_transfer and verified_cas
     and length(p_device)=36 and p_device !~ '[^0-9a-fA-F-]' then
    insert into public.pos7_store2_tablet_candidates_r216
      (user_id,device_id,seen_at,preflight_revision)
    values (auth.uid(),p_device,clock_timestamp(),current_snapshot.revision)
    on conflict (user_id,device_id) do update
      set seen_at=excluded.seen_at,preflight_revision=excluded.preflight_revision;
  end if;
  if p_activate is true then
    if bound then
      -- Safe idempotent success, including after first successful publication.
      null;
    elsif not may_transfer then
      raise exception 'store2_transfer_blocked_not_empty_or_publisher_changed';
    elsif not verified_cas then
      raise exception 'store2_stock_cas_verification_failed';
    else
      update public.pos7_owner_snapshot
      set publisher_device=p_device, updated_at=now()
      where store_id='pos7' and revision=0
        and publisher_device=current_snapshot.publisher_device;
      if not found then raise exception 'store2_transfer_race'; end if;
      bound := true;
    end if;
  end if;
  return jsonb_build_object(
    'project','rmskuolsiqbzxuakofpb',
    'publisher_bound',bound,
    'may_activate',(may_transfer and verified_cas),
    'cas_verified',verified_cas,
    'revision',current_snapshot.revision,
    'has_business_data',not (current_snapshot.revision=0 and current_snapshot.sections='{}'::jsonb),
    'activation_requested',(p_activate is true)
  );
end
$function$
;

