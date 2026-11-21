# POS7 R287 — Verified staging checkpoint

Date: 2026-11-21

- Original R213 and R215 Android ZIP archives retrieved via GitHub Actions successfully.
- Original HTML sources copied byte-for-byte into staging Android project; no cloud data changed.
- New HTML entry gate selects the branch before any sync code is loaded; **new-device activation is deliberately blocked**.
- Existing-device path is read-only and verifies selected Supabase owner and publisher identity; **operational app navigation is deliberately blocked until write paths have been fenced**.
- Local checks: 10/10 Python tests, and Node JavaScript syntax OK.
- This is NOT an APK, NOT release-ready and must never replace installed R213/R215.
- Full R287 report and staging ZIP were created in the conversation artifacts. GitHub main remains untouched.

Next blocking tasks: secure native branch binding; Supabase owner rebind/other writers; cloud restore including images and ledgers; atomic publisher/inventory gate cutover; old-device local-only behavior; installed signature and versionCode verification.
