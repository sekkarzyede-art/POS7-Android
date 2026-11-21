\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.pos7_owner_snapshot (
 store_id text PRIMARY KEY, revision bigint NOT NULL, publisher_device text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pos7_inventory_gate_r152 (
 store_id text PRIMARY KEY, enabled boolean NOT NULL, approved_device text NOT NULL
);
INSERT INTO public.pos7_owner_snapshot VALUES ('pos7',42,'tablet-A',now());
INSERT INTO public.pos7_inventory_gate_r152 VALUES ('pos7',true,'tablet-A');
\ir private_rotation.sql
CREATE SCHEMA test;
CREATE OR REPLACE FUNCTION test.receipt(rid uuid,target text,expected_rev bigint,ep bigint,expiry interval DEFAULT interval '5 minutes',proof boolean DEFAULT true,restored boolean DEFAULT true,pending boolean DEFAULT false,issuer text DEFAULT 'trusted-server-v1')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO pos7_handoff_private.verified_receipts
 (receipt_id,store_id,target_device,expected_revision,expected_epoch,expires_at,proof_verified,restored_sections_verified,unresolved_local_writes,verified_by)
 VALUES(rid,'pos7',target,expected_rev,ep,now()+expiry,proof,restored,pending,issuer);
END;$$;
CREATE OR REPLACE FUNCTION test.fail(rid uuid,target text,expected text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pos7_handoff_private.apply_verified_rotation(rid,'pos7',target);
 RAISE EXCEPTION 'expected failure missing: %',expected;
EXCEPTION WHEN OTHERS THEN
 IF SQLERRM LIKE 'expected failure missing:%' OR position(expected in SQLERRM)=0 THEN
  RAISE EXCEPTION 'unexpected outcome: %, expected %', SQLERRM,expected;
 END IF;
END;$$;
DO $$
DECLARE e bigint; rid uuid;
BEGIN
 IF has_function_privilege('authenticated','pos7_handoff_private.apply_verified_rotation(uuid,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'unauthorized role has execute grant';
 END IF;
 IF has_schema_privilege('authenticated','pos7_handoff_private','USAGE') THEN
  RAISE EXCEPTION 'unauthorized role has schema usage';
 END IF;
 RAISE NOTICE 'PASS no authenticated execute/usage';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000001','tablet-B',42,0);
 e:=pos7_handoff_private.apply_verified_rotation('00000000-0000-4000-8000-000000000001','pos7','tablet-B');
 IF e<>1 OR (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-B'
   OR (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-B' THEN
   RAISE EXCEPTION 'first A->B cutover failed';
 END IF;
 RAISE NOTICE 'PASS A->B atomic handoff';
 PERFORM test.fail('00000000-0000-4000-8000-000000000001','tablet-B','rotation_receipt_unverified');
 RAISE NOTICE 'PASS consumed receipt denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000002','tablet-A',42,0);
 PERFORM test.fail('00000000-0000-4000-8000-000000000002','tablet-A','stale_rotation_epoch');
 RAISE NOTICE 'PASS stale epoch denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000003','tablet-A',41,1);
 PERFORM test.fail('00000000-0000-4000-8000-000000000003','tablet-A','snapshot_changed_recover_again');
 RAISE NOTICE 'PASS stale snapshot denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000004','tablet-A',42,1,interval '-1 second');
 PERFORM test.fail('00000000-0000-4000-8000-000000000004','tablet-A','rotation_receipt_unverified');
 RAISE NOTICE 'PASS expired receipt denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000005','tablet-A',42,1,interval '5 minutes',false);
 PERFORM test.fail('00000000-0000-4000-8000-000000000005','tablet-A','rotation_receipt_unverified');
 RAISE NOTICE 'PASS missing device proof denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000006','tablet-A',42,1,interval '5 minutes',true,false);
 PERFORM test.fail('00000000-0000-4000-8000-000000000006','tablet-A','rotation_receipt_unverified');
 RAISE NOTICE 'PASS missing restore verification denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000007','tablet-A',42,1,interval '5 minutes',true,true,true);
 PERFORM test.fail('00000000-0000-4000-8000-000000000007','tablet-A','rotation_receipt_unverified');
 RAISE NOTICE 'PASS unresolved local write denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000008','tablet-A',42,1,interval '5 minutes',true,true,false,'untrusted');
 PERFORM test.fail('00000000-0000-4000-8000-000000000008','tablet-A','rotation_receipt_unverified');
 RAISE NOTICE 'PASS untrusted issuer denied';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000009','tablet-A',42,1);
 PERFORM test.fail('00000000-0000-4000-8000-000000000009','tablet-Z','rotation_receipt_unverified');
 RAISE NOTICE 'PASS target mismatch denied';
 IF (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-B'
  OR (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-B'
  OR (SELECT epoch FROM pos7_handoff_private.rotation_state WHERE store_id='pos7')<>1 THEN
  RAISE EXCEPTION 'denied paths changed state';
 END IF;
 RAISE NOTICE 'PASS all denied paths leave both devices aligned';
 e:=pos7_handoff_private.apply_verified_rotation('00000000-0000-4000-8000-000000000009','pos7','tablet-A');
 IF e<>2 OR (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-A'
  OR (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-A' THEN
   RAISE EXCEPTION 'B->A failed';
 END IF;
 RAISE NOTICE 'PASS B->A return to original tablet';
 PERFORM test.receipt('00000000-0000-4000-8000-000000000010','tablet-B',42,2);
 DELETE FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7';
 PERFORM test.fail('00000000-0000-4000-8000-000000000010','tablet-B','inventory_gate_missing');
 IF (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-A'
  OR (SELECT epoch FROM pos7_handoff_private.rotation_state WHERE store_id='pos7')<>2
  OR (SELECT consumed_at FROM pos7_handoff_private.verified_receipts WHERE receipt_id='00000000-0000-4000-8000-000000000010') IS NOT NULL
 THEN RAISE EXCEPTION 'gate missing resulted in partial cutover'; END IF;
 RAISE NOTICE 'PASS missing inventory gate leaves publisher and receipt unchanged';
END$$;
