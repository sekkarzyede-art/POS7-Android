# POS7 R296 — Real Android-source compile verified, RELEASE NO-GO

**Verified GitHub Actions:** https://github.com/sekkarzyede-art/POS7-Android/actions/runs/44955505759 — **SUCCESS**.

- Created `pos7-release-audit/r296/make_unified_compile_candidate.py` which extracts real R213 and R215 ZIPs and preserves both original HTML sources byte-for-byte inside one Android project, while replacing startup HTML with a fail-closed selection screen.
- Same Android `MainActivity.java` and `AndroidManifest.xml` in both original archive sources.
- Added read-only native `NativeBranchBridge` and `NativeBranchPolicy`; `canPublish() == false`. No business functionality is enabled, no migration, restore or cutover.
- GitHub Actions compiles project via Gradle task `:app:compileDebugJavaWithJavac` under JDK 17 / Android 35, **success**.
- GitHub Actions produced `R296_UNIFIED_ANDROID_SOURCE_COMPILE_ONLY.zip` with 38 files, and verified SHA256 manifest; downloaded in conversation and checked ZIP integrity. Conversation artifact `POS7_R296_COMPILE_VERIFIED_SOURCE_AND_REPORT.zip` bundles source + audit + Arabic MD.
- **This is NOT an APK and MUST NOT be installed as replacement.** It does not implement working branch binding, owner authentication, complete restore, server receipt service, legacy write RPC fencing, local-only mode, or signing/versionCode checks.
- No production Supabase mutations; branch `main` unchanged. Release gate: NO-GO.
