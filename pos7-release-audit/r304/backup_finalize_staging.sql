-- Apply after R293, R300, and R302 on an isolated database.
BEGIN;

-- Enabling a store requires a separate migration that actually fences all legacy writers.
CREATE TABLE pos7_handoff_private.backup_cutover_enabled (
  store_id text PRIMARY KEY CHECK (store_id = 'pos7')
);
REVOKE ALL ON pos7_handoff_private.backup_cutover_enabled FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.pos7_backup_finalize_service(
  p_challenge_id uuid,
  p_owner_id uuid,
  p_backup_hash text,
  p_replacement_sections jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pos7_handoff_private, pg_temp
AS $fn$
DECLARE
  challenge pos7_handoff_private.device_challenges%rowtype;
  result jsonb;
BEGIN
  SELECT * INTO challenge
  FROM pos7_handoff_private.device_challenges
  WHERE challenge_id = p_challenge_id
  FOR UPDATE;

  IF NOT FOUND
     OR challenge.owner_id IS DISTINCT FROM p_owner_id
     OR challenge.sections_sha256 IS DISTINCT FROM p_backup_hash
     OR challenge.consumed_at IS NOT NULL
     OR challenge.expires_at <= extract(epoch FROM clock_timestamp()) THEN
    RAISE EXCEPTION 'challenge_unavailable';
  END IF;

  PERFORM 1 FROM pos7_handoff_private.backup_cutover_enabled
  WHERE store_id = challenge.store_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'legacy_writers_not_fenced';
  END IF;

  INSERT INTO pos7_handoff_private.backup_candidates (
    candidate_id, store_id, owner_id, device_id, branch_id, backup_sha256,
    replacement_sections, expected_cloud_revision, expected_epoch, proof_verified,
    backup_verified, legacy_writers_fenced, restore_complete, expires_at
  ) VALUES (
    challenge.challenge_id, challenge.store_id, challenge.owner_id, challenge.device_id::text,
    challenge.branch_id, p_backup_hash, p_replacement_sections, challenge.expected_revision,
    challenge.expected_epoch, true, true, true, true, to_timestamp(challenge.expires_at)
  );
  result := pos7_handoff_private.apply_backup_authority_cutover(p_challenge_id, p_owner_id);
  UPDATE pos7_handoff_private.device_challenges
  SET consumed_at = clock_timestamp()
  WHERE challenge_id = p_challenge_id;
  RETURN result;
END
$fn$;

REVOKE ALL ON FUNCTION public.pos7_backup_finalize_service(uuid,uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos7_backup_finalize_service(uuid,uuid,text,jsonb)
  TO service_role;
-- Retire the experimental finalizer that rotates against the cloud snapshot.
REVOKE EXECUTE ON FUNCTION public.pos7_handoff_finalize_service(uuid,uuid,text)
  FROM service_role;
REVOKE EXECUTE ON FUNCTION pos7_handoff_private.apply_backup_authority_cutover(uuid,uuid)
  FROM service_role;
COMMIT;
