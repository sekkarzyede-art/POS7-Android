\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.pos7_owner_snapshot(store_id text PRIMARY KEY,revision bigint NOT NULL,publisher_device text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),sections jsonb NOT NULL);
CREATE TABLE public.pos7_inventory_gate_r152(store_id text PRIMARY KEY,enabled boolean NOT NULL,approved_device text NOT NULL);
CREATE SCHEMA pos7_handoff_private;
CREATE TABLE pos7_handoff_private.rotation_state(store_id text PRIMARY KEY,epoch bigint NOT NULL,updated_at timestamptz DEFAULT now());
REVOKE ALL ON SCHEMA pos7_handoff_private FROM PUBLIC,anon,authenticated;
INSERT INTO public.pos7_owner_snapshot VALUES('pos7',811,'tablet-A',now(), '{"cash":{},"cashLedger":{},"customers":{},"expenses":{},"meta":{},"payments":{},"products":{"old":{"stock":999}},"purchases":{},"receipts":{},"returns":{},"sales":{"OLD":{"total":800}},"suppliers":{},"wallet":{},"walletTx":{}}');
INSERT INTO public.pos7_inventory_gate_r152 VALUES('pos7',true,'tablet-A');
INSERT INTO pos7_handoff_private.rotation_state VALUES('pos7',0,now());
\ir backup_authoritative_cutover.sql
CREATE SCHEMA test;
CREATE FUNCTION test.candidate(id uuid,owner uuid,device text,rev bigint,ep bigint,proof boolean DEFAULT true,verified boolean DEFAULT true,fenced boolean DEFAULT true,restored boolean DEFAULT true,sections jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO pos7_handoff_private.backup_candidates
 (candidate_id,store_id,owner_id,device_id,branch_id,backup_sha256,replacement_sections,expected_cloud_revision,expected_epoch,proof_verified,backup_verified,legacy_writers_fenced,restore_complete,expires_at)
 VALUES(id,'pos7',owner,device,'tab1',repeat('a',64),
 coalesce(sections,'{"cash":{},"cashLedger":{},"customers":{},"expenses":{},"meta":{},"payments":{},"products":{"backup":{"stock":15}},"purchases":{},"receipts":{},"returns":{},"sales":{"BACKUP":{"total":15}},"suppliers":{},"wallet":{},"walletTx":{}}'::jsonb),
 rev,ep,proof,verified,fenced,restored,clock_timestamp()+interval '5 minutes');
END $$;
CREATE FUNCTION test.reject(id uuid,owner uuid,code text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
 BEGIN
  PERFORM pos7_handoff_private.apply_backup_authority_cutover(id,owner);
  RAISE EXCEPTION 'unexpected_success';
 EXCEPTION WHEN OTHERS THEN
  actual:=SQLERRM;
  IF actual='unexpected_success' OR position(code in actual)=0 THEN
   RAISE EXCEPTION 'wrong outcome %, expected %',actual,code;END IF;
 END;
END $$;
DO $$
DECLARE owner uuid:='11111111-1111-4111-8111-111111111111'; before_cloud jsonb;result jsonb;
BEGIN
 IF has_function_privilege('authenticated','pos7_handoff_private.apply_backup_authority_cutover(uuid,uuid)','EXECUTE') OR
 has_schema_privilege('authenticated','pos7_handoff_private','USAGE') OR
 NOT has_function_privilege('service_role','pos7_handoff_private.apply_backup_authority_cutover(uuid,uuid)','EXECUTE') THEN
 RAISE EXCEPTION 'unsafe grants';END IF;
 RAISE NOTICE 'PASS private service-only cutover';
 before_cloud:=(SELECT sections FROM public.pos7_owner_snapshot WHERE store_id='pos7');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000001',owner,'tablet-B-new',811,0);
 result:=pos7_handoff_private.apply_backup_authority_cutover('20000000-0000-4000-8000-000000000001',owner);
 IF (result->>'revision')::bigint<>812 OR (result->>'epoch')::bigint<>1
 OR (SELECT sections->'products'->'backup'->>'stock' FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'15'
 OR (SELECT sections->'sales' ? 'OLD' FROM public.pos7_owner_snapshot WHERE store_id='pos7')
 OR (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-B-new'
 OR (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-B-new'
 OR (SELECT previous_sections FROM pos7_handoff_private.pre_cutover_archives WHERE candidate_id='20000000-0000-4000-8000-000000000001') IS DISTINCT FROM before_cloud
 THEN RAISE EXCEPTION 'backup authority replacement not atomic';END IF;
 RAISE NOTICE 'PASS backup replaces DIFFERENT cloud data, archives old sections and changes both device locks atomically';
 PERFORM test.reject('20000000-0000-4000-8000-000000000001',owner,'backup_cutover_not_authorized');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000002',owner,'tablet-A-return',812,1);
 PERFORM test.reject('20000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','backup_cutover_not_authorized');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000003',owner,'tablet-A-return',812,1,false);
 PERFORM test.reject('20000000-0000-4000-8000-000000000003',owner,'backup_cutover_not_authorized');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000004',owner,'tablet-A-return',812,1,true,false);
 PERFORM test.reject('20000000-0000-4000-8000-000000000004',owner,'backup_cutover_not_authorized');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000005',owner,'tablet-A-return',812,1,true,true,false);
 PERFORM test.reject('20000000-0000-4000-8000-000000000005',owner,'backup_cutover_not_authorized');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000006',owner,'tablet-A-return',812,1,true,true,true,false);
 PERFORM test.reject('20000000-0000-4000-8000-000000000006',owner,'backup_cutover_not_authorized');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000007',owner,'tablet-A-return',811,1);
 PERFORM test.reject('20000000-0000-4000-8000-000000000007',owner,'cloud_revision_changed_retry');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000008',owner,'tablet-A-return',812,0);
 PERFORM test.reject('20000000-0000-4000-8000-000000000008',owner,'rotation_epoch_changed_retry');
 PERFORM test.candidate('20000000-0000-4000-8000-000000000009',owner,'tablet-A-return',812,1,true,true,true,true,'{"products":{}}'::jsonb);
 PERFORM test.reject('20000000-0000-4000-8000-000000000009',owner,'invalid_backup_section');
 RAISE NOTICE 'PASS replay, unauthorized owner, missing proof/backup/fencing/restore, stale revision/epoch and bad sections denied';
 IF (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-B-new' OR
 (SELECT epoch FROM pos7_handoff_private.rotation_state WHERE store_id='pos7')<>1 THEN
 RAISE EXCEPTION 'denied path corrupted publisher';END IF;
 result:=pos7_handoff_private.apply_backup_authority_cutover('20000000-0000-4000-8000-000000000002',owner);
 IF (result->>'epoch')::bigint<>2 OR
 (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-A-return' OR
 (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-A-return'
 THEN RAISE EXCEPTION 'B-to-A return failed';END IF;
 RAISE NOTICE 'PASS B to A return with a newly restored backup';
 PERFORM test.candidate('20000000-0000-4000-8000-00000000000a',owner,'tablet-B-return',813,2);
 DELETE FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7';
 PERFORM test.reject('20000000-0000-4000-8000-00000000000a',owner,'inventory_gate_missing');
 IF (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-A-return'
 OR EXISTS(SELECT 1 FROM pos7_handoff_private.pre_cutover_archives WHERE candidate_id='20000000-0000-4000-8000-00000000000a')
 THEN RAISE EXCEPTION 'partial archive or publisher update';END IF;
 RAISE NOTICE 'PASS missing gate leaves original state unchanged';
END$$;
