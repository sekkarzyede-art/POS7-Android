BEGIN;
CREATE SCHEMA IF NOT EXISTS pos7_handoff_private;
REVOKE ALL ON SCHEMA pos7_handoff_private FROM PUBLIC, anon, authenticated;
CREATE TABLE pos7_handoff_private.rotation_state (
 store_id text PRIMARY KEY, epoch bigint NOT NULL DEFAULT 0 CHECK(epoch >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pos7_handoff_private.verified_receipts (
 receipt_id uuid PRIMARY KEY,store_id text NOT NULL,target_device text NOT NULL,
 expected_revision bigint NOT NULL,expected_epoch bigint NOT NULL,
 expires_at timestamptz NOT NULL,consumed_at timestamptz,
 proof_verified boolean NOT NULL DEFAULT false,
 restored_sections_verified boolean NOT NULL DEFAULT false,
 unresolved_local_writes boolean NOT NULL DEFAULT true,
 verified_by text NOT NULL DEFAULT 'none'
);
REVOKE ALL ON ALL TABLES IN SCHEMA pos7_handoff_private FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION pos7_handoff_private.apply_verified_rotation(
 p_receipt_id uuid,p_store_id text,p_target_device text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pos7_handoff_private, pg_temp
AS $f$
DECLARE
 r pos7_handoff_private.verified_receipts%rowtype;
 s public.pos7_owner_snapshot%rowtype;
 g public.pos7_inventory_gate_r152%rowtype;
 old_epoch bigint;
 next_epoch bigint;
BEGIN
 IF p_store_id <> 'pos7' OR p_target_device IS NULL OR length(p_target_device)<8 THEN
  RAISE EXCEPTION 'invalid_rotation_target';
 END IF;
 SELECT * INTO r FROM pos7_handoff_private.verified_receipts
 WHERE receipt_id=p_receipt_id FOR UPDATE;
 IF NOT FOUND OR r.store_id IS DISTINCT FROM p_store_id
    OR r.target_device IS DISTINCT FROM p_target_device
    OR r.consumed_at IS NOT NULL OR r.expires_at <= clock_timestamp()
    OR NOT r.proof_verified OR NOT r.restored_sections_verified
    OR r.unresolved_local_writes OR r.verified_by <> 'trusted-server-v1' THEN
   RAISE EXCEPTION 'rotation_receipt_unverified';
 END IF;
 SELECT * INTO s FROM public.pos7_owner_snapshot WHERE store_id=p_store_id FOR UPDATE;
 IF NOT FOUND OR s.revision IS DISTINCT FROM r.expected_revision THEN
   RAISE EXCEPTION 'snapshot_changed_recover_again';
 END IF;
 SELECT * INTO g FROM public.pos7_inventory_gate_r152 WHERE store_id=p_store_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inventory_gate_missing'; END IF;
 INSERT INTO pos7_handoff_private.rotation_state(store_id,epoch) VALUES(p_store_id,0)
 ON CONFLICT DO NOTHING;
 SELECT epoch INTO old_epoch FROM pos7_handoff_private.rotation_state
 WHERE store_id=p_store_id FOR UPDATE;
 IF old_epoch IS DISTINCT FROM r.expected_epoch THEN
  RAISE EXCEPTION 'stale_rotation_epoch';
 END IF;
 next_epoch:=old_epoch+1;
 UPDATE public.pos7_owner_snapshot SET publisher_device=p_target_device,updated_at=now()
 WHERE store_id=p_store_id;
 UPDATE public.pos7_inventory_gate_r152 SET approved_device=p_target_device
 WHERE store_id=p_store_id;
 UPDATE pos7_handoff_private.rotation_state SET epoch=next_epoch,updated_at=now()
 WHERE store_id=p_store_id;
 UPDATE pos7_handoff_private.verified_receipts SET consumed_at=now()
 WHERE receipt_id=p_receipt_id;
 RETURN next_epoch;
END
$f$;
REVOKE ALL ON FUNCTION pos7_handoff_private.apply_verified_rotation(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
COMMIT;
