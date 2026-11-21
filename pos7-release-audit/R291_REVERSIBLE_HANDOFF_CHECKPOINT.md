# POS7 R291 — Reversible tablet publishing A→B→A (STAGING ONLY)

Date 2026-11-21. **No production changes.**

R291 local artifact `POS7_R291_REVERSIBLE_HANDOFF_STAGE.zip` created in conversation workspace. Contains complete `PublisherRotationPolicy.java`, `NativeBranchPolicy.java`, `PublisherRotationPolicyTest.java`, read-only SQL audit, non-executable transactional cutover specification, and Arabic continuity report.

**Tests:** `javac ... && java com.sokkarzeyedeh.pos7.PublisherRotationPolicyTest` -> PASS **34 assertions**, including A→B→A, publisher/inventory alignment, current epoch, replay-stale epoch, cross-store isolation, outstanding writes and stale restore rejection.

Read-only project comparison:
- Both branches expose authenticated EXECUTE for `pos7_owner_publish` and legacy `pos7_owner_rebind_device`.
- Store 2 additionally exposes authenticated EXECUTE for `pos7_claim_tablet_publisher`.
- EXECUTE alone does **not** prove a bypass because internal definitions may have additional guards. They must be inspected.

**Release-blocking conditions:** All writer RPCs must validate native key-bound device and current epoch; old-device local-only mode; complete audited restore incl photos and unresolved local operations; server-side transactional publisher and inventory gate update; Android APK signing/versionCode equivalence tests.

Not yet a usable transfer implementation and not an APK. Main unchanged; neither production cloud was modified. Estimated remaining work: 30–40% (rough only).
