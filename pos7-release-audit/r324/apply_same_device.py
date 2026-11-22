"""R324 Store2: adds same-device authoritative cloud matching after R323.
Never changes store1 build, native signing, or owner/sync privileges.
"""
from pathlib import Path
base=Path('r305-android/tab2/POS7_Tablet')
assets=base/'app/src/main/assets'
hfile=assets/'index.html'
gfile=base/'app/build.gradle'
gate=assets/'restore_transfer.js'
h=hfile.read_text(encoding='utf8')
g=gfile.read_text(encoding='utf8')
s=gate.read_text(encoding='utf8')
assert h.count('المتجر الثاني — قاعدة مستقلة • 485.7.229-r323-tab2')==1
h=h.replace('المتجر الثاني — قاعدة مستقلة • 485.7.229-r323-tab2',
 'المتجر الثاني — قاعدة مستقلة • 485.7.229-r324-tab2',1)
assert g.count("versionName '485.7.229-r323-tab2'")==1
g=g.replace("versionName '485.7.229-r323-tab2'",
 "versionName '485.7.229-r324-tab2'",1)
old="name !== 'pos7_restore_transfer_r305'"
new="""!['pos7_restore_transfer_r305',
 'pos7_restore_same_device_r324',
 'pos7_restore_same_device_status_r324'].includes(name)"""
assert s.count(old)==1,'R305 RPC guard changed; stop'
s=s.replace(old,new,1)
# R305 already prevents ordinary sync using POS7_RESTORE_PENDING_R305.
assert h.count("if(localStorage.getItem('POS7_RESTORE_PENDING_R305'))return false;")==1
assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in h
assert 'window.pos310Installed=true' in h
assert 'window.pos311SaleActive' not in h
assert h.count('<script src="local_restore_r323.js"></script>')==1
h=h.replace('<script src="local_restore_r323.js"></script>',
 '<script src="local_restore_r323.js"></script>\n<script src="same_device_r324.js"></script>',1)
js=Path('pos7-release-audit/r324/same_device_cloud.js').read_text(encoding='utf8')
assert "localStorage.removeItem(RESTORE)" in js
assert "pos7_restore_same_device_status_r324" in js
assert "pos7_restore_same_device_r324" in js
assert "POS7_R174_SMART_CAS_SERVER_VERIFIED" not in js
assets.joinpath('same_device_r324.js').write_text(js,encoding='utf8')
hfile.write_text(h,encoding='utf8')
gfile.write_text(g,encoding='utf8')
gate.write_text(s,encoding='utf8')
print('R324 Store2: guarded publisher-preserving RPCs only; ordinary sync still paused until verified')
