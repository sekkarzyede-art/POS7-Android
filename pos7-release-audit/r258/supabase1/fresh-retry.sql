CREATE OR REPLACE FUNCTION pos7_push_private_r258.due_ids(p_now timestamptz,p_has_targets boolean)
RETURNS SETOF bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
 SELECT e.id FROM public.pos7_push_events e
 WHERE p_has_targets AND e.delivered_at IS NULL AND e.processing_at IS NULL
   AND e.created_at>p_now-interval '30 minutes'
   AND coalesce(e.payload#>>'{_r258,status}','retry') IN ('retry','no_target')
   AND (e.payload#>>'{_r258,retry_at}' IS NULL OR e.payload#>>'{_r258,retry_at}'<=to_char(p_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
 ORDER BY e.created_at,e.id LIMIT 10
$fn$;
CREATE OR REPLACE FUNCTION pos7_push_private_r258.tick()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' SET lock_timeout TO '1s' AS $fn$
DECLARE args text[]; event_id bigint; n integer:=0; moment timestamptz:=clock_timestamp(); targets boolean;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('pos7_push_r258_tick')) THEN RETURN 0; END IF;
 PERFORM pos7_push_private_r258.recover();
 SELECT EXISTS(SELECT 1 FROM public.pos7_owner_push_tokens t JOIN public.pos7_members m ON m.store_id=t.store_id AND m.user_id=t.owner_id AND m.role='owner' WHERE t.store_id='pos7') INTO targets;
 IF NOT targets THEN RETURN 0;END IF;
 SELECT string_to_array(encode(t.tgargs,'escape'),chr(92)||'000') INTO args
 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.pos7_push_events'::regclass AND t.tgname='pos7_push_events_insert' AND t.tgenabled IN ('O','A');
 IF args IS NULL OR args[1] IS DISTINCT FROM 'https://jdcolkgzwqpwbfvcrdje.supabase.co/functions/v1/smart-worker' OR args[2] IS DISTINCT FROM 'POST' OR coalesce(args[3]::jsonb->>'x-pos7-webhook-secret','')='' THEN
  RAISE WARNING 'POS7_R258 retry webhook configuration mismatch';RETURN 0;
 END IF;
 UPDATE public.pos7_push_events SET processing_at=NULL WHERE delivered_at IS NULL AND created_at>moment-interval '30 minutes' AND processing_at<moment-interval '5 minutes';
 FOR event_id IN SELECT * FROM pos7_push_private_r258.due_ids(moment,targets) LOOP
  PERFORM net.http_post(url:=args[1],body:=jsonb_build_object('record',jsonb_build_object('id',event_id)),params:='{}'::jsonb,headers:=args[3]::jsonb,timeout_milliseconds:=25000);
  n:=n+1;
 END LOOP;
 RETURN n;
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pos7_push_private_r258 FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('pos7-r258-fresh-push-retry','* * * * *','SELECT pos7_push_private_r258.tick();');