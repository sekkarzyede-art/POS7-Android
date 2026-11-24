CREATE OR REPLACE FUNCTION pos7_push_private_r258.retire_exact_hash(p_hash text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE n integer;
BEGIN
 IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid token fingerprint'; END IF;
 DELETE FROM public.pos7_owner_push_tokens t
 WHERE t.store_id='pos7' AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(t.fcm_token,'UTF8')),'hex')=p_hash
 AND NOT EXISTS(SELECT 1 FROM public.pos7_push_device_deliveries d WHERE d.owner_id=t.owner_id AND d.device_id=t.device_id);
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION public.pos7_retire_invalid_push_token_r258(p_hash text)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT pos7_push_private_r258.retire_exact_hash(p_hash)
$function$
;
REVOKE ALL ON FUNCTION pos7_push_private_r258.retire_exact_hash(text) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA pos7_push_private_r258 TO service_role;
GRANT EXECUTE ON FUNCTION pos7_push_private_r258.retire_exact_hash(text) TO service_role;
REVOKE ALL ON FUNCTION public.pos7_retire_invalid_push_token_r258(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos7_retire_invalid_push_token_r258(text) TO service_role;
