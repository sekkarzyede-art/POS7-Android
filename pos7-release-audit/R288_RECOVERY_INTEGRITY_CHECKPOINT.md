# POS7 R288 — Cloud restore integrity stage (not deployed)

Status: **local verification module implemented and tested; server cutover NOT authorized**.

Verified original staging code from R287: branch lock is stored in WebView localStorage only and therefore is not a trusted native identity binding.

Read-only Supabase inspection (2026-11-21):
- Store 1 project: jdcolkgzwqpwbfvcrdje; observed revision 3705.
- Store 2 project: rmskuolsiqbzxuakofpb; observed revision 3589.
- Both snapshots have 14 sections: cash, cashLedger, customers, expenses, meta, payments, products, purchases, receipts, returns, sales, suppliers, wallet, walletTx.
- These revision numbers are diagnostic only, not constants.

Created artifact `POS7_R288_RECOVERY_INTEGRITY_STAGE.zip` in conversation:
- `recovery_integrity.py`: validates project/store/revision, all 14 complete sections and canonical SHA256 per section, publisher consistency; cannot authorize replacement.
- `test_recovery_integrity.py`: 12/12 local tests pass.
- `cloud_coverage_readonly.sql`: read-only coverage metadata queries.
- Continuity report in Arabic.

BLOCKERS BEFORE APK:
- native device identity and branch binding;
- all writer RPCs and legacy rebind guarded server-side;
- full restoration coverage, including photo storage, pending operations, invoices outside snapshot;
- transactional publisher & inventory gate cutover;
- installed certificate and Android versionCode comparisons.

No production SQL writes, no publisher changes, no APK build. Main branch untouched.
