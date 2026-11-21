# POS7 R292 — Actual production writer-definition audit (READ ONLY)

Date: 2026-11-21. No live SQL writes, no APK, no publisher changes.

Examined actual definitions of public.pos7_owner_rebind_device and pos7_owner_publish in each original project, and store2 pos7_claim_tablet_publisher.

- Both stores: authenticated can EXECUTE pos7_owner_rebind_device (SECURITY DEFINER). Definition authorizes owner and merely checks device-id length, then updates publisher_device directly WITHOUT checking restore, epoch, device proof, or inventory gate. Confirmed a real old-path bypass to the *future* safe-transfer flow.
- Both stores: pos7_owner_publish checks current publisher text and expected revision, but not a Keystore signature or publishing epoch. Store2 includes additional clone guard.
- Store2: pos7_claim_tablet_publisher checks owner and formatted device and rejects a *different* current publisher; not an arbitrary rebinder.
- Confirmed both stores have pos7_inventory_gate_r152(store_id,enabled,approved_device).

Produced conversation ZIP `POS7_R292_SAFE_HANDOFF_DESIGN.zip` containing:
- `R292_PRIVATE_ROTATION_STAGING_ONLY.sql`: isolated-database migration draft defining private receipt and epoch schema, transactional update of publisher + inventory device, strict fail-closed checks; NOT for production.
- `R292_READONLY_AUDIT.sql`: non-mutating inspection.
- `test_r292_structure.py`: 16/16 structural checks pass (not database concurrency tests).
- `POS7_R292_CONTINUITY.md`: Arabic full report.

Release blockers: implement server-issued cryptographically verified proof, cover all old writer RPC paths without breaking existing tablets, integration-test PostgreSQL rollback and concurrency, validate native APK identity and installed signatures.

**This SQL is not ready for deployment; no actual transaction or transfer was performed.**
