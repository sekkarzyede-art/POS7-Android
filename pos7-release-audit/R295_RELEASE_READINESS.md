# POS7 R295 — Combined test gate

Result: **SUCCESS**, rerun after fixing PostgreSQL cluster-global role creation:
https://github.com/sekkarzyede-art/POS7-Android/actions/runs/44955082909

The workflow `.github/workflows/pos7-r295-gate.yml` verifies the original R213 and R215 ZIP source audits, R290 Java cryptographic proof contract checks, and R293/R294 real **isolated PostgreSQL** tests. It never writes to either production Supabase project or builds an APK.

**Release decision: NO-GO.** The staged R290 native bridge returns `canPublish=false` and `business_enabled=false`, actual device registration/receipt authority is not integrated, real restore and old-device local-only functionality are incomplete, the legacy production owner rebind remains a bypass, and installed APK signer/versionCode compatibility has not been verified. A successful unit/DB gate is not evidence that Android can safely run or replace a tablet.

No production changes; repository main unchanged. Full Arabic continuity report and ZIP are in the conversation artifacts.
