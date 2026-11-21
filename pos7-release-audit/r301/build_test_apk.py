#!/usr/bin/env python3
"""R301: Standalone offline-only backup-recovery test APK; cannot replace installed POS7."""
from pathlib import Path
import subprocess,re
subprocess.run(['python3','pos7-release-audit/r299/build_offline_restore_candidate.py'],check=True)
app=Path('r296-android/tab1/POS7_Tablet')
gradle=app/'app/build.gradle';g=gradle.read_text()
old="applicationId 'com.sokkarzeyedeh.pos7'"
assert g.count(old)==1
g=g.replace(old,"applicationId 'com.sokkarzeyedeh.pos7.recoverytest'")
gradle.write_text(g)
manifest=app/'app/src/main/AndroidManifest.xml'
m=manifest.read_text()
internet='<uses-permission android:name="android.permission.INTERNET" />'
assert m.count(internet)==1
m=m.replace(internet,'')
assert 'android:label="متجر سكر زيادة"' in m
m=m.replace('android:label="متجر سكر زيادة"','android:label="POS7 فحص النسخة - دون إنترنت"')
manifest.write_text(m)
java=app/'app/src/main/java/com/sokkarzeyedeh/pos7/MainActivity.java'
assert 'settings.setBlockNetworkLoads(true);' in java.read_text()
assert 'android.permission.INTERNET' not in m
assert "applicationId 'com.sokkarzeyedeh.pos7.recoverytest'" in g
print('R301 stand-alone TEST package verified. Cannot update or replace production POS7 APK.')
