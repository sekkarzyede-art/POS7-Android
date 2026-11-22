"""R325 Store1 only: install safe publisher-preserving product reconciliation.
Based on R322 signed Store1 release; never patches Store2 nor auto-runs any RPC.
"""
from pathlib import Path
p=Path('r321-android/tab1/POS7_Tablet')
assets=p/'app/src/main/assets'
hfile=assets/'index.html'
gfile=p/'app/build.gradle'
h=hfile.read_text(encoding='utf8')
g=gfile.read_text(encoding='utf8')
assert "versionName '485.7.229-r322-tab1'" in g
assert h.count('pos7-r322-native-state-storage')==1
assert h.count('pos7-r321-tab1-quota-recovery')==1
assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in h
assert 'pos7_inventory_commit_r155' in h
assert h.count('async function sync(auto=false,afterCommit=false){')==1
assert 'POS7_TRIAL188_CLEAN' in h
assert h.count('pos7-r325-safe-sync')==0
js=Path('pos7-release-audit/r325/tab1_safe_rebase.js').read_text(encoding='utf8')
assert 'localStorage.removeItem(VERIFIED)' not in js
assert "pos7_restore_same_device_r325" in js
assert "pos7_restore_same_device_status_r325" in js
assert "pos7_owner_rebind_device" not in js
assert "pos7_owner_ack" not in js
assert "POS7_TRANSFER_COMPLETED_R305" not in js
# External JS asset avoids HTMLParser inline-script token confusion.
(assets/'r325_safe_rebase.js').write_text(js,encoding='utf8')
h+='\n<script id="pos7-r325-safe-sync" src="r325_safe_rebase.js"></script>\n'
g=g.replace("versionName '485.7.229-r322-tab1'","versionName '485.7.229-r327-tab1'",1)
hfile.write_text(h,encoding='utf8')
gfile.write_text(g,encoding='utf8')
print('R325 Store1: safety-gated manual repair UI installed without modifying existing accounts or sync flows')
