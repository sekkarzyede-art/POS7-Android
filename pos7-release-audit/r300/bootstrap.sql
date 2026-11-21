\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.pos7_owner_snapshot(
 store_id text PRIMARY KEY,revision bigint NOT NULL,
 publisher_device text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pos7_inventory_gate_r152(
 store_id text PRIMARY KEY,enabled boolean NOT NULL,approved_device text NOT NULL
);
INSERT INTO public.pos7_owner_snapshot VALUES('pos7',42,'tablet-original',now());
INSERT INTO public.pos7_inventory_gate_r152 VALUES('pos7',true,'tablet-original');
\ir ../r293/private_rotation.sql
\ir R300_server_staging.sql
DO $$
DECLARE out jsonb; e bigint;
BEGIN
 IF has_function_privilege('authenticated','public.pos7_handoff_finalize_service(uuid,uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'public exposed service-only finalize'; END IF;
 IF NOT has_function_privilege('service_role','public.pos7_handoff_finalize_service(uuid,uuid,text)','EXECUTE') THEN
   RAISE EXCEPTION 'service role lacks grant'; END IF;
 RAISE NOTICE 'PASS authenticated blocked and service_role permitted';
 out:=public.pos7_handoff_begin_service(
 '70000000-0000-4000-8000-000000000001','tab1','jdcolkgzwqpwbfvcrdje',
 '70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003',
 'TEST_PUBLIC_KEY_NOT_ACTUAL','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 42,0,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
 extract(epoch from clock_timestamp())::bigint,(extract(epoch from clock_timestamp())::bigint)+120);
 IF out->>'challenge_id' <> '70000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'challenge creation wrong'; END IF;
 RAISE NOTICE 'PASS service-only challenge issuance';
 out:=public.pos7_handoff_finalize_service(
 '70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002',
 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
 IF out->>'ok' <> 'true' OR (out->>'epoch')::bigint<>1 THEN RAISE EXCEPTION 'finalize failed';END IF;
 IF (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7') <>
 '70000000-0000-4000-8000-000000000003' OR
 (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7') <>
 '70000000-0000-4000-8000-000000000003' THEN RAISE EXCEPTION 'partial rotation'; END IF;
 RAISE NOTICE 'PASS trusted finalize atomically moves publisher and inventory';
 BEGIN
  PERFORM public.pos7_handoff_finalize_service(
   '70000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000002',
   'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  RAISE EXCEPTION 'expected replay failure absent';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'expected replay%' OR position('challenge_unavailable' in SQLERRM)=0 THEN RAISE;END IF;
 END;
 RAISE NOTICE 'PASS one-time challenge cannot finalize twice';
 IF (SELECT epoch FROM pos7_handoff_private.rotation_state WHERE store_id='pos7')<>1 THEN
  RAISE EXCEPTION 'replay altered epoch'; END IF;
END $$;
