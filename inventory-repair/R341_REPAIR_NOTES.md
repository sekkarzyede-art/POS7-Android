# POS7 — Inventory R341 repair investigation (2026-11-24)

## Verified on live Store 1 (read-only)
- 4,413 catalog entries, 7 barcode pairs differing by leading zeros.
- 1 pending and 31 processed inventory commands, owner snapshot revision 3793.
- `pos7_inventory_commit_r155` rejects a changed baseline, absent/untrusted stock revision, and mismatched identity.
- `pos7_inventory_prepare_r340` already exists and rewrites a pending command baseline/revision to current cloud snapshot after explicit tablet confirmation. It rejects untrusted revision and only matches exact barcode; zero-leading aliases are not supported.
- `pos7_inventory_commit_batch_r212` loops one event at a time and catches errors separately, so it is **not atomic for the whole batch**.
- Current main workflow builds **Store 2 R215** using `POS7_المتجر_الثاني_TAB_R215_Android_Source.zip`, **not the installed Store 1 baseline**. Never replace Store 1 APK from this workflow.

## Canonicalization policy
1. Normalize for lookup only: numeric digit strings strip leading zeros; preserve literal barcode and legacy product id in historical invoices.
2. Do not merge stock automatically; distinct product records remain distinct until owner verifies same SKU/packaging.
3. Never rewrite historical invoices, accounting documents or receipts in place.
4. Enforce uniqueness of normalized barcode on newly inserted products after alias selection. Treat ambiguous match as review only.
5. Inventory snapshot is authoritative at scan-time; record exact timestamp and journal of intervening sales/purchases/returns. Determine final stock from counted quantity + **only subsequent stock movements**, with idempotency key. A stale stock revision is reviewable, not sufficient to ignore movements.
6. Process a batch in a single transaction with row locks and all-or-nothing rollback; record processed events to reject duplicate replays. Do not alter current R155 until the upgraded tablet is ready.
7. Scope owner commands, aliases and approvals by store_id and publisher_device.

## Safe implementation order
1. Audit seven live pairs (see SQL audit). Confirm product identity, actual package and master product ID.
2. Introduce alias mapping with unique scoped keys + provenance, no physical product deletion.
3. Add transactional inventory commit RPC with movement accounting and explicit tablet verification.
4. Update tablet/phone HTML to use resolver and new RPC, clear pending state after success; retain fallback safely.
5. Test 5/10 SKU workflow, repeated approve, concurrent sale, disconnected retry, store switching, and zero-leading barcode.
6. Build a signed **Store 1** release from the correct verified source and original certificate, with incremented Android versionCode. Then separately build Store 2/Phone only if needed.

## Status
Investigation and safe audit completed. Source APK not built and no production data mutated. Main workflow is for Store 2, so any claim of Store 1 APK readiness would be misleading.
