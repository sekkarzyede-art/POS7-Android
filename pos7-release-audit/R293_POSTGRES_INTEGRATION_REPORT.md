# POS7 R293 — PostgreSQL integration success (isolated)

**Date:** 2026-11-21  
**Repository:** `sekkarzyede-art/POS7-Android`  
**Testing branch:** `pos7-r285-audit-only`  
**Workflow:** `.github/workflows/pos7-r293-postgres.yml`  
**GitHub Actions result:** **SUCCESS** https://github.com/sekkarzyede-art/POS7-Android/actions/runs/44954275305

## Actual implementation
- `pos7-release-audit/r293/private_rotation.sql` implements **one PostgreSQL transaction** that locks a verified one-use receipt, current snapshot and inventory gate, checks current revision and epoch, then atomically updates both publisher and inventory-approved tablet, increments the epoch and consumes the receipt.
- `pos7-release-audit/r293/postgres_integration.sql` runs against a **real disposable PostgreSQL 16 container**, with synthetic snapshot/device values, NEVER against either store.
- Tested A→B→A, replay denial, stale epoch and revision denial, expired receipt, missing signed proof/restore, unresolved writes, untrusted issuer, device mismatch, no partial change on denied paths or missing inventory gate, and no authenticated access to private schema/function.
- The PostgreSQL suite succeeded on GitHub Actions; unlike R292, this is not merely static source inspection.

## No go-live / APK authorization
- There is no trusted service creating actual validated receipts yet. The test creates synthetic trusted receipts using superuser in an isolated database.
- Production legacy `pos7_owner_rebind_device` bypasses new receipt/epoch controls and must be migrated **only after** older clients are supported.
- Production `pos7_owner_publish` checks device ID text, not a cryptographic key or epoch.
- Additional inventory writer paths, Android Keystore on-device integration, complete restore, verified installed signer and versionCode remain blocking.
- No production database change; no main branch change; no APK built or deployed.
