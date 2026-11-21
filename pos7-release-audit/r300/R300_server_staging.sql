-- R300 STAGING ONLY: Depends on R293 private_rotation.sql.
-- Never apply to a production store while R213/R215 old writers still exist.
BEGIN;
CREATE TABLE IF NOT EXISTS pos7_handoff_private.device_challenges (
  challenge_id uuid PRIMARY KEY,
  store_id text NOT NULL DEFAULT 'pos7' CHECK(store_id='pos7'),
  branch_id text NOT NULL CHECK(branch_id IN ('tab1','tab2')),
  project_id text NOT NULL,
  owner_id uuid NOT NULL,
  device_id uuid NOT NULL,
  public_key_spki_base64 text NOT NULL,
  nonce_hex text NOT NULL,
  expected_revision bigint NOT NULL,
  expected_epoch bigint NOT NULL,
  sections_sha256 text NOT NULL,
  issued_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON pos7_handoff_private.device_challenges FROM PUBLIC,anon,authenticated;

-- Caller is trusted Edge Function carrying service_role; database never trusts user data directly.
CREATE OR REPLACE FUNCTION public.pos7_handoff_begin_service(
 p_challenge_id uuid,p_branch text,p_project text,p_owner_id uuid,
 p_device_id uuid,p_public_key_spki text,p_nonce text,p_expected_revision bigint,
 p_expected_epoch bigint,p_sections_hash text,p_issued_at bigint,p_expires_at bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pos7_handoff_private,pg_temp AS $f$
DECLARE s public.pos7_owner_snapshot%rowtype; e bigint;
BEGIN
 IF p_branch NOT IN('tab1','tab2') OR
    (p_branch='tab1' AND p_project<>'jdcolkgzwqpwbfvcrdje') OR
    (p_branch='tab2' AND p_project<>'rmskuolsiqbzxuakofpb') OR
    p_nonce !~ '^[a-f0-9]{64}$' OR p_sections_hash !~ '^[a-f0-9]{64}$' OR
    p_public_key_spki IS NULL OR length(p_public_key_spki)>1024 OR
    p_expires_at<=p_issued_at OR p_expires_at-p_issued_at>120 OR
    abs(extract(epoch from clock_timestamp())::bigint-p_issued_at)>30 OR
    p_owner_id IS NULL THEN RAISE EXCEPTION 'invalid_challenge_params'; END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR SHARE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM p_expected_revision THEN
  RAISE EXCEPTION 'stale_cloud_snapshot'; END IF;
 SELECT epoch INTO e FROM pos7_handoff_private.rotation_state
 WHERE store_id='pos7' FOR SHARE;
 IF coalesce(e,0) IS DISTINCT FROM p_expected_epoch THEN
  RAISE EXCEPTION 'stale_epoch'; END IF;
 INSERT INTO pos7_handoff_private.device_challenges
 (challenge_id,store_id,branch_id,project_id,owner_id,device_id,public_key_spki_base64,
  nonce_hex,expected_revision,expected_epoch,sections_sha256,issued_at,expires_at)
 VALUES(p_challenge_id,'pos7',p_branch,p_project,p_owner_id,p_device_id,
  p_public_key_spki,p_nonce,p_expected_revision,p_expected_epoch,p_sections_hash,p_issued_at,p_expires_at);
 RETURN jsonb_build_object('challenge_id',p_challenge_id,'nonce',p_nonce,'issued_at',p_issued_at,'expires_at',p_expires_at);
END
$f$;

CREATE OR REPLACE FUNCTION public.pos7_handoff_get_service(p_challenge_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pos7_handoff_private,pg_temp AS $f$
 SELECT to_jsonb(c) FROM pos7_handoff_private.device_challenges c
 WHERE c.challenge_id=p_challenge_id;
$f$;

CREATE OR REPLACE FUNCTION public.pos7_handoff_finalize_service(
 p_challenge_id uuid,p_owner_id uuid,p_sections_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pos7_handoff_private,pg_temp AS $f$
DECLARE c pos7_handoff_private.device_challenges%rowtype;
        receipt uuid; next_epoch bigint;
BEGIN
 SELECT * INTO c FROM pos7_handoff_private.device_challenges
 WHERE challenge_id=p_challenge_id FOR UPDATE;
 IF NOT FOUND OR c.owner_id IS DISTINCT FROM p_owner_id OR
   c.sections_sha256 IS DISTINCT FROM p_sections_hash OR
   c.consumed_at IS NOT NULL OR c.expires_at<=extract(epoch from clock_timestamp())::bigint THEN
   RAISE EXCEPTION 'challenge_unavailable';
 END IF;
 receipt:=gen_random_uuid();
 INSERT INTO pos7_handoff_private.verified_receipts
 (receipt_id,store_id,target_device,expected_revision,expected_epoch,
  expires_at,proof_verified,restored_sections_verified,unresolved_local_writes,verified_by)
 VALUES(receipt,'pos7',c.device_id::text,c.expected_revision,c.expected_epoch,
  to_timestamp(c.expires_at),true,true,false,'trusted-server-v1');
 next_epoch:=pos7_handoff_private.apply_verified_rotation(receipt,'pos7',c.device_id::text);
 UPDATE pos7_handoff_private.device_challenges SET consumed_at=clock_timestamp()
 WHERE challenge_id=p_challenge_id;
 RETURN jsonb_build_object('ok',true,'epoch',next_epoch,'publisher_device',c.device_id,
 'receipt_id',receipt,'revision',c.expected_revision);
END
$f$;

-- Revoke default PUBLIC EXECUTE and grant ONLY to service_role secret held in Edge.
REVOKE ALL ON FUNCTION public.pos7_handoff_begin_service(uuid,text,text,uuid,uuid,text,text,bigint,bigint,text,bigint,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pos7_handoff_get_service(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pos7_handoff_finalize_service(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos7_handoff_begin_service(uuid,text,text,uuid,uuid,text,text,bigint,bigint,text,bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.pos7_handoff_get_service(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pos7_handoff_finalize_service(uuid,uuid,text) TO service_role;
COMMIT;

-- CAUTION: R293 private rotation function still only verified synthetic receipt state;
-- R300 Edge MUST verify P-256 signature, user owner role, matching full sections digest,
-- branch/project and no locally uncommitted work BEFORE calling finalize_service.
-- OLD RPCs remain live bypasses until compatibility migration; deployment is blocked.