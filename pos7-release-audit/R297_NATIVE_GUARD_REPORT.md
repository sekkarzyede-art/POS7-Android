# POS7 R297 — Native branch preflight fail-closed (NOT RELEASE-READY)

**GitHub CI (real Android compiler): SUCCESS** — https://github.com/sekkarzyede-art/POS7-Android/actions/runs/44955994355

- Staged original combined R213+R215 Android source in isolated branch.
- Fixed preflight that previously accepted missing native branch binding: now missing native verified status, cross-branch ID, or wrong Supabase project all **deny**.
- No privileged action exposed in JS bridge; `canPublish()` always returns false.
- 10 local Java unit tests pass; GitHub Actions additionally compiled real Android Java source with Gradle and Android SDK successfully.
- Local source ZIP and detailed Arabic `POS7_R297_CONTINUITY.md` created as downloadable conversation artifacts.
- Production release BLOCKED: no server-verified native identity issuance, no full restore, no actual backend cutover integration, old RPC bypasses remain, no installed-signature/versionCode proof.
- No production writes, no change to main or installed applications. **Do not install staging source or pretend it is an APK.**
