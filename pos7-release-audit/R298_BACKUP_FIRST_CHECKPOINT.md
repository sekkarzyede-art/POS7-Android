# POS7 R298 — Backup-first tablet replacement staging

**Verified Github Action:** https://github.com/sekkarzyede-art/POS7-Android/actions/runs/44956815257 — SUCCESS.

Read original R213 implementation: `makeBackupObject()` produces JSON `{app:'POS7',version:110,createdAt,kind,data:state}`. The original `applyBackup()` directly replaces local state after weak checks; do NOT reuse it for device replacement without authorization.

Implemented offline `backup_preflight.js` parser/validator with 15 passing JS regression tests. Staging Android entry page permits choosing one of two branch labels and selecting a local JSON backup for **inspection only**; displays backup timestamp and counts, rejects missing sections, invalid data, duplicates, future dates, and warns about stale backup, lack of cloud revision match, and unknown external images.

GitHub Actions rebuilt the original R213/R215 combined Android source and compiled successfully with Gradle, then exported verified source ZIP (NO APK).

This **does not perform an actual restore** or certify the source store. The backup is untrusted JSON, and native device identity and server-side cloud comparison remain blocking. Production `pos7_owner_rebind_device` remains a known bypass; do not revoke live RPC before compatible upgrade.

No Supabase production changes, no main branch changes, no installed tablet changes. **RELEASE NO-GO**.
