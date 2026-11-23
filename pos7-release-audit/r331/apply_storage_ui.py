"""R331 store1: move storage controls into existing sales settings without
changing R321/R322 storage implementations, cloud state or invoice code."""
from pathlib import Path
base=Path('r321-android/tab1/POS7_Tablet')
assets=base/'app/src/main/assets'
h=assets/'index.html'
gradle=base/'app/build.gradle'
s=h.read_text(encoding='utf8')
g=gradle.read_text(encoding='utf8')
assert s.count('id="saleSettingsPage"')==1
assert s.count('pos7R321Toggle')>0
assert s.count('pos7R322Info')>0
assert s.count('pos7-r325-safe-sync')==1
assert 'POS7_R174_SMART_CAS_SERVER_VERIFIED' in s
assert s.count('pos7R331StorageSettings')==0
assert g.count("versionName '485.7.229-r332-tab1'")==1
js=Path('pos7-release-audit/r331/storage_controls_in_settings.js').read_text(encoding='utf8')
assert "['pos7R321Toggle','pos7R322Info']" in js
assert "localStorage." not in js
assert ".onclick=" not in js
(assets/'r331_storage_settings.js').write_text(js,encoding='utf8')
s+='\n<script id="pos7-r331-storage-settings" src="r331_storage_settings.js"></script>\n'
# Version is set by the preceding R325 baseline patch.
h.write_text(s,encoding='utf8')
gradle.write_text(g,encoding='utf8')
print('R331: R321 and R322 buttons moved into saleSettingsPage, preserving dialogs, storage and cloud state.')
