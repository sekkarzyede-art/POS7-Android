"""R333 Store1: read-only Android disk capacity + POS7 native state file size
inside existing sale settings card. No storage write, deletion, cloud call,
inventory/fiscal change or signing change.
Run AFTER R322, R325, R331 patches.
"""
from pathlib import Path
base=Path('r321-android/tab1/POS7_Tablet')
app=base/'app/src/main'
java=app/'java/com/sokkarzeyedeh/pos7/MainActivity.java'
html=app/'assets/index.html'
gradle=base/'app/build.gradle'
j=java.read_text(encoding='utf8')
h=html.read_text(encoding='utf8')
g=gradle.read_text(encoding='utf8')
marker='''        @JavascriptInterface public boolean pos322WriteState(String stateJson) {
            return pos322TrustedPage && pos322NativeState != null
                && pos322NativeState.write(stateJson);
        }'''
assert j.count(marker)==1, 'R322 trusted bridge changed'
inject='''

        // R333: read-only capacity from the private Android data partition.
        // JS is served only from the trusted bundled POS7 asset.
        @JavascriptInterface public String pos333StorageStats() {
            if (!pos322TrustedPage) return "{\\"error\\":\\"untrusted_page\\"}";
            try {
                android.os.StatFs fs = new android.os.StatFs(context.getFilesDir().getAbsolutePath());
                long total = fs.getTotalBytes();
                long free = fs.getAvailableBytes();
                java.io.File state = new java.io.File(
                    new java.io.File(context.getFilesDir(), "pos7_native_state_r322"),
                    "pos7_main_state.json");
                long dbSize = state.isFile() ? state.length() : -1L;
                org.json.JSONObject result = new org.json.JSONObject();
                result.put("totalBytes", total);
                result.put("freeBytes", free);
                result.put("pos7DatabaseBytes", dbSize);
                // Existing R322 single-state safety limit: 128 MiB.
                result.put("pos7DatabaseLimitBytes", 128L * 1024L * 1024L);
                result.put("source", "android-internal-data");
                return result.toString();
            } catch (Exception e) {
                android.util.Log.e("POS7-R333", "Storage stats failed", e);
                return "{\\"error\\":\\"storage_stats_unavailable\\"}";
            }
        }'''
j=j.replace(marker,marker+inject,1)
assert h.count('id="pos7-r331-storage-settings"')==1
assert h.count('id="saleSettingsPage"')==1
assert h.count('id="pos7-r333-storage-dashboard"')==0
assert "POS7_R174_SMART_CAS_SERVER_VERIFIED" in h
assert g.count("versionName '485.7.229-r333-tab1'")==1
js=Path('pos7-release-audit/r333/storage_dashboard.js').read_text(encoding='utf8')
assert "pos333StorageStats" in js
assert "pos7R331StorageSettings" in js
assert "localStorage.setItem" not in js
assert "localStorage.removeItem" not in js
assert "cloud.rpc" not in js
target=app/'assets/r333_storage_dashboard.js'
target.write_text(js,encoding='utf8')
h+='\n<script id="pos7-r333-storage-dashboard" src="r333_storage_dashboard.js"></script>\n'
java.write_text(j,encoding='utf8')
html.write_text(h,encoding='utf8')
gradle.write_text(g,encoding='utf8')
print('R333: read-only Android StatFs and native JSON state byte size in saleSettingsPage')
