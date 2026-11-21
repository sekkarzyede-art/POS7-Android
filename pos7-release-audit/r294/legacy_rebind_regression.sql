\set ON_ERROR_STOP on
-- R294 ISOLATED ONLY: regression fixture reproducing legacy RPC bypass.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE owner_user NOLOGIN;
CREATE TABLE public.pos7_owner_snapshot(
 store_id text PRIMARY KEY, revision bigint NOT NULL,
 publisher_device text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.pos7_inventory_gate_r152(
 store_id text PRIMARY KEY,enabled boolean NOT NULL,approved_device text NOT NULL);
INSERT INTO public.pos7_owner_snapshot VALUES ('pos7',42,'tablet-A',now());
INSERT INTO public.pos7_inventory_gate_r152 VALUES ('pos7',true,'tablet-A');

-- Excerpt of current production legacy rebind behavior, reduced owner check for test.
CREATE FUNCTION public.pos7_owner_rebind_device(p_device text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE cur public.pos7_owner_snapshot%rowtype;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'fixture_owner_access_required'; END IF;
 IF p_device IS NULL OR length(p_device)<8 THEN RAISE EXCEPTION 'invalid device'; END IF;
 SELECT * INTO cur FROM public.pos7_owner_snapshot WHERE store_id='pos7' FOR UPDATE;
 UPDATE public.pos7_owner_snapshot SET publisher_device=p_device,updated_at=now()
 WHERE store_id='pos7';
 RETURN cur.revision;
END $$;
-- Model production EXECUTE permissions independently of RPC membership check.
GRANT EXECUTE ON FUNCTION public.pos7_owner_rebind_device(text) TO authenticated;
DO $$
BEGIN
 IF NOT has_function_privilege('authenticated','public.pos7_owner_rebind_device(text)','EXECUTE') THEN
  RAISE EXCEPTION 'fixture should expose legacy RPC';
 END IF;
 PERFORM public.pos7_owner_rebind_device('tablet-OLD-UNVERIFIED');
 IF (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-OLD-UNVERIFIED'
 OR (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-A'
 THEN RAISE EXCEPTION 'legacy mismatch not reproduced'; END IF;
 RAISE NOTICE 'PASS detected legacy rebind can diverge publisher and inventory device';
END $$;
-- A future safe migration MUST remove legacy access after client compatibility,
-- not now on live systems.
REVOKE EXECUTE ON FUNCTION public.pos7_owner_rebind_device(text) FROM PUBLIC,anon,authenticated;
DO $$
BEGIN
 IF has_function_privilege('authenticated','public.pos7_owner_rebind_device(text)','EXECUTE') THEN
  RAISE EXCEPTION 'legacy RPC still exposed';
 END IF;
 RAISE NOTICE 'PASS legacy rebind privilege fenced in isolated fixture';
END $$;
-- Reset then import transactional replacement.
UPDATE public.pos7_owner_snapshot SET publisher_device='tablet-A' WHERE store_id='pos7';
\ir ../r293/private_rotation.sql
INSERT INTO pos7_handoff_private.verified_receipts(
 receipt_id,store_id,target_device,expected_revision,expected_epoch,expires_at,
 proof_verified,restored_sections_verified,unresolved_local_writes,verified_by)
VALUES ('00000000-0000-4000-8000-0000000000aa','pos7','tablet-B',42,0,
 now()+interval '5 minutes',true,true,false,'trusted-server-v1');
DO $$
DECLARE e bigint;
BEGIN
 e:=pos7_handoff_private.apply_verified_rotation('00000000-0000-4000-8000-0000000000aa','pos7','tablet-B');
 IF e<>1 OR
 (SELECT publisher_device FROM public.pos7_owner_snapshot WHERE store_id='pos7')<>'tablet-B'
 OR (SELECT approved_device FROM public.pos7_inventory_gate_r152 WHERE store_id='pos7')<>'tablet-B'
 THEN RAISE EXCEPTION 'protected rotation failed'; END IF;
 RAISE NOTICE 'PASS protected rotation keeps publisher and inventory aligned';
END $$;
