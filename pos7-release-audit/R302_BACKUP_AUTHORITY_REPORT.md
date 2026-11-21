# POS7 R302 — Backup is authoritative; staging verified

**Decision:** For new tablets, restore the original POS7 JSON backup and use its data as the source of truth. No content comparison against existing cloud sections is required.

**Verified isolated GitHub CI:** https://github.com/sekkarzyede-art/POS7-Android/actions/runs/44959574625 (SUCCESS).

### Shipped in the audit branch
- `r302/backup_authoritative_cutover.sql`: protects 14 canonical sections; archives previous cloud sections, publisher and inventory approver; atomically replaces both cloud contents and publisher/inventory authority, increments cloud revision and epoch, and consumes request.
- `r302/test_backup_authority.sql`: disposable PostgreSQL integration tests prove that an intentionally different backup replaces cloud state, with old state archived, replay denied, failed cutovers rolled back, and A→B→A returning to the old tablet.
- `r302/backup_sections_export.js`: uses the **original POS7 R213/R215** `window.pos7BuildOwnerSnapshot` function after local restore to produce all 14 mapped sections and local state hash, without allowing cloud publishing.
- `r302/backup_sections_export.test.cjs`: verifies branch/restore guard and completeness checks in Node.

### Important release blockers
- SQL is **not deployed** to the two production Supabase projects; both installed tablets and GitHub `main` remain unchanged.
- Production Edge handler still compares to cloud digest and would require a secure redesign to verify the restored backup instead, stage its transformed sections and sign the exact candidate.
- Existing production rebind and inventory writer RPCs must be reconciled/fenced before publisher transfer, but not simply revoked while installed tablets depend on them.
- No real Android end-to-end enrollment, cloud import or final signed APK yet.

**Release status: NO-GO.** Passing isolated tests is not evidence of safely moving a live tablet.