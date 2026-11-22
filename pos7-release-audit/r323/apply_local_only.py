"""R323 Store2 ONLY. After R320, add offline/local-only acknowledgement.
The R305 sync gate and all stock/cloud owner permissions stay untouched.
"""
from pathlib import Path
p=Path("r305-android/tab2/POS7_Tablet")
assets=p/"app/src/main/assets"
hfile=assets/"index.html";gradle=p/"app/build.gradle"
h=hfile.read_text(encoding="utf8")
g=gradle.read_text(encoding="utf8")
old="المتجر الثاني — قاعدة مستقلة • 485.7.229-r320-tab2"
new="المتجر الثاني — قاعدة مستقلة • 485.7.229-r323-tab2"
assert h.count(old)==1
h=h.replace(old,new,1)
assert h.count('<script src="restore_transfer.js"></script>')==1
h=h.replace('<script src="restore_transfer.js"></script>',
 '<script src="restore_transfer.js"></script>\n<script src="local_restore_r323.js"></script>',1)
assert h.count('POS7_RESTORE_PENDING_R305')>=1
assert h.count('POS7_R174_SMART_CAS_SERVER_VERIFIED')>=1
assert h.count('window.pos310Installed=true')==1
assert 'window.pos311SaleActive' not in h
assert g.count("versionName '485.7.229-r320-tab2'")==1
g=g.replace("versionName '485.7.229-r320-tab2'","versionName '485.7.229-r323-tab2'",1)
source=Path("pos7-release-audit/r323/local_restore.js").read_text(encoding="utf8")
assert "localStorage.removeItem(RESTORE)" not in source
assert "localStorage.setItem('POS7_R174_SMART_CAS_SERVER_VERIFIED'" not in source
assert "cloud.rpc" not in source and "pos7_owner_publish" not in source
assets.joinpath("local_restore_r323.js").write_text(source,encoding="utf8")
hfile.write_text(h,encoding="utf8")
gradle.write_text(g,encoding="utf8")
print("R323 tab2: offline local acknowledgement installed; existing pending gate remains active and all cloud permissions unchanged")
