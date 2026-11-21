# POS7 R289 — Native Android branch preflight (staging only)

- R287 actual Android project stage updated with Java `NativeBranchPolicy` and read-only `NativeBranchBridge`.
- Bridge is registered as `Pos7NativeBranch` in MainActivity.
- Gate HTML checks native policy before owner-authenticated read-only cloud preflight. Browser without native bridge is blocked from authentication.
- No native method can set branch, publisher or grant publishing. The status always returns `business_enabled:false`.
- No billing, inventory, invoice, sync or cloud write is allowed by this stage.
- Verified 15/15 Java JVM policy tests and Node syntax check.
- **Not yet proven secure for existing devices**: native preferences are unbound. Legacy WebView localStorage branch/device is not a trusted Android identity; native authoritative enrollment still requires authenticated server proof.
- **Not yet an APK**: Gradle APK build and Android instrumentation tests are not completed.
- **No production Supabase changes; main branch unchanged**.

Hard blockers:
1. Native device enrollment with verified challenge signed by an Android Keystore key.
2. Server RPC wrappers restrict all legacy writer paths, including rebind and inventory.
3. Complete read-only restore, then atomic publisher+inventory cutover on isolated DB.
4. Old tablet local-only mode; compatible Android certificate/versionCode proof for R213 and R215.

R289 full staged Android source ZIP and tests remain in conversation artifact.
