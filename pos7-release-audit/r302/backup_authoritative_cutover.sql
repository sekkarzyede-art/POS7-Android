-- R302: scratch PostgreSQL only. NEVER use directly in production.
-- Backup wins over DIFFERENT cloud sections ONLY AFTER trust gates.
BEGIN;
CREATE TABLE pos7_handoff_private.backup_candidates(
 candidate_id uuid PRIMARY KEY, store_id text NOT NULL CHECK(store_id='pos7'),
 owner_id uuid NOT NULL, device_id text NOT NULL CHECK(length(device_id)>=8),
 branch_id text NOT NULL CHECK(branch_id IN ('tab1','tab2')),
 backup_sha256 text NOT NULL CHECK(backup_sha256 ~ '^[0-9a-f]{64}$'),
 replacement_sections jsonb NOT NULL CHECK(jsonb_typeof(replacement_sections)='object'),
 expected_cloud_revision bigint NOT NULL,expected_epoch bigint NOT NULL,
 proof_verified boolean NOT NULL DEFAULT false,
 backup_verified boolean NOT NULL DEFAULT false,
 legacy_writers_fenced boolean NOT NULL DEFAULT false,
 restore_complete boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,consumed_at timestamptz
);
CREATE TABLE pos7_handoff_private.pre_cutover_archives(
 candidate_id uuid PRIMARY KEY,store_id text NOT NULL,
 previous_revision bigint NOT NULL,previous_epoch bigint NOT NULL,
 previous_publisher_device text NOT NULL,previous_gate_device text NOT NULL,
 previous_sections jsonb NOT NULL,previous_updated_at timestamptz,
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON pos7_handoff_private.backup_candidates,pos7_handoff_private.pre_cutover_archives FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION pos7_handoff_private.apply_backup_authority_cutover(p_candidate_id uuid,p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pos7_handoff_private,pg_temp AS $fn$
DECLARE c pos7_handoff_private.backup_candidates%rowtype;
 s public.pos7_owner_snapshot%rowtype;
 g public.pos7_inventory_gate_r152%rowtype;
 old_epoch bigint; new_epoch bigint;k text;
 mandatory text[]:=ARRAY['cash','cashLedger','customers','expenses','meta','payments',
 'products','purchases','receipts','returns','sales','suppliers','wallet','walletTx'];
BEGIN
 SELECT * INTO c FROM pos7_handoff_private.backup_candidates
 WHERE candidate_id=p_candidate_id FOR UPDATE;
 IF NOT FOUND OR c.owner_id IS DISTINCT FROM p_owner_id OR c.consumed_at IS NOT NULL
 OR c.expires_at<=clock_timestamp() OR NOT c.proof_verified OR NOT c.backup_verified
 OR NOT c.legacy_writers_fenced OR NOT c.restore_complete THEN
  RAISE EXCEPTION 'backup_cutover_not_authorized';
 END IF;
 FOREACH k IN ARRAY mandatory LOOP
  IF NOT(c.replacement_sections ? k) OR
   jsonb_typeof(c.replacement_sections -> k)<>'object' THEN
   RAISE EXCEPTION 'invalid_backup_section_%',k;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(c.replacement_sections))<>14 THEN
  RAISE EXCEPTION 'unexpected_backup_sections';END IF;
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id=c.store_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inventory_gate_missing';END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id=c.store_id FOR UPDATE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM c.expected_cloud_revision
 OR s.revision>=9223372036854775806 THEN RAISE EXCEPTION 'cloud_revision_changed_retry';END IF;
 INSERT INTO pos7_handoff_private.rotation_state(store_id,epoch) VALUES(c.store_id,0)
 ON CONFLICT DO NOTHING;
 SELECT epoch INTO old_epoch FROM pos7_handoff_private.rotation_state WHERE store_id=c.store_id FOR UPDATE;
 IF old_epoch IS DISTINCT FROM c.expected_epoch OR old_epoch>=9223372036854775806 THEN
  RAISE EXCEPTION 'rotation_epoch_changed_retry';END IF;
 INSERT INTO pos7_handoff_private.pre_cutover_archives
 (candidate_id,store_id,previous_revision,previous_epoch,previous_publisher_device,
 previous_gate_device,previous_sections,previous_updated_at)
 VALUES(c.candidate_id,c.store_id,s.revision,old_epoch,s.publisher_device,g.approved_device,
 s.sections,s.updated_at);
 new_epoch:=old_epoch+1;
 UPDATE public.pos7_owner_snapshot SET sections=c.replacement_sections,
 publisher_device=c.device_id,revision=s.revision+1,updated_at=clock_timestamp()
 WHERE store_id=c.store_id;
 UPDATE public.pos7_inventory_gate_r152 SET approved_device=c.device_id WHERE store_id=c.store_id;
 UPDATE pos7_handoff_private.rotation_state SET epoch=new_epoch,updated_at=clock_timestamp()
 WHERE store_id=c.store_id;
 UPDATE pos7_handoff_private.backup_candidates SET consumed_at=clock_timestamp()
 WHERE candidate_id=c.candidate_id;
 RETURN jsonb_build_object('ok',true,'epoch',new_epoch,'revision',s.revision+1,
 'publisher_device',c.device_id,'archived_candidate_id',c.candidate_id,
 'backup_sha256',c.backup_sha256);
END $fn$;
REVOKE ALL ON FUNCTION pos7_handoff_private.apply_backup_authority_cutover(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA pos7_handoff_private TO service_role;
GRANT EXECUTE ON FUNCTION pos7_handoff_private.apply_backup_authority_cutover(uuid,uuid) TO service_role;
COMMIT;
